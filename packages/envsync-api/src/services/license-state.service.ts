import { CacheClient } from "@/libs/cache";
import { DB } from "@/libs/db";
import { EnterpriseCertificateVerifierService, type CertificateValidationResult } from "@/services/enterprise-certificate-verifier.service";
import { EditionPolicyService } from "@/services/edition-policy.service";
import { EntitlementService } from "@/services/entitlement.service";
import { DEFAULT_ENTERPRISE_FEATURE_SET } from "@/services/entitlement.types";
import { LicenseServerClient, type LicenseVerificationRequest, type LicenseVerificationResponse } from "@/services/license-server.client";
import { config } from "@/utils/env";

function looksLikeJwt(value: string | null | undefined): value is string {
	return Boolean(value && value.split(".").length === 3);
}

const LICENSE_STATE_ID = "default";
const LICENSE_CACHE_KEY = "envsync:license_state";
const HEARTBEAT_INTERVAL_MS = 60_000;

type LicenseStateTestOverrides = {
	server_url?: string;
	license_key?: string;
	install_fingerprint?: string;
	heartbeat_interval_ms?: number;
};

type PersistedLicenseStatus = "unknown" | "active" | "inactive" | "expired" | "error" | "locked";
type PersistedLicenseState = {
	id: string;
	status: PersistedLicenseStatus;
	signed_lease: string | null;
	lease_expires_at: Date | null;
	fingerprint: string | null;
	last_verified_at: Date | null;
	last_error_code: string | null;
	last_error_message: string | null;
	validation_mode?: "none" | "lease" | "certificate" | null;
	certificate_serial_hex?: string | null;
	certificate_fingerprint_sha256?: string | null;
	certificate_subject?: string | null;
	certificate_issuer?: string | null;
	certificate_expires_at?: Date | null;
	root_ca_fingerprint_sha256?: string | null;
	validated_at?: Date | null;
	created_at: Date | null;
	updated_at: Date | null;
};

function toDate(value?: string | Date | null) {
	if (!value) {
		return null;
	}

	return value instanceof Date ? value : new Date(value);
}

function normalizeState(value: Record<string, unknown>): PersistedLicenseState {
	return {
		id: String(value.id ?? LICENSE_STATE_ID),
		status: (value.status as PersistedLicenseStatus | undefined) ?? "unknown",
		signed_lease: (value.signed_lease as string | null | undefined) ?? null,
		lease_expires_at: toDate(value.lease_expires_at as string | Date | null | undefined),
		fingerprint: (value.fingerprint as string | null | undefined) ?? null,
		last_verified_at: toDate(value.last_verified_at as string | Date | null | undefined),
		last_error_code: (value.last_error_code as string | null | undefined) ?? null,
		last_error_message: (value.last_error_message as string | null | undefined) ?? null,
		validation_mode: (value.validation_mode as PersistedLicenseState["validation_mode"] | undefined) ?? null,
		certificate_serial_hex: (value.certificate_serial_hex as string | null | undefined) ?? null,
		certificate_fingerprint_sha256: (value.certificate_fingerprint_sha256 as string | null | undefined) ?? null,
		certificate_subject: (value.certificate_subject as string | null | undefined) ?? null,
		certificate_issuer: (value.certificate_issuer as string | null | undefined) ?? null,
		certificate_expires_at: toDate(value.certificate_expires_at as string | Date | null | undefined),
		root_ca_fingerprint_sha256: (value.root_ca_fingerprint_sha256 as string | null | undefined) ?? null,
		validated_at: toDate(value.validated_at as string | Date | null | undefined),
		created_at: toDate(value.created_at as string | Date | null | undefined),
		updated_at: toDate(value.updated_at as string | Date | null | undefined),
	};
}

function deriveRootDomain() {
	try {
		return new URL(config.DASHBOARD_URL).hostname;
	} catch {
		return undefined;
	}
}

export class LicenseStateService {
	static #heartbeatStarted = false;
	static #heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	static #testOverrides: LicenseStateTestOverrides | null = null;

	private static async ensurePersistedStateRow() {
		const db = await DB.getInstance();
		let state = await db
			.selectFrom("license_state")
			.selectAll()
			.where("id", "=", LICENSE_STATE_ID)
			.executeTakeFirst();

		if (state) {
			return state;
		}

		const now = new Date();
		await db
			.insertInto("license_state")
			.values({
				id: LICENSE_STATE_ID,
				status: "unknown",
				signed_lease: null,
				lease_expires_at: null,
				fingerprint: this.getInstallFingerprint() || null,
				last_verified_at: null,
				last_error_code: null,
				last_error_message: null,
				validation_mode: EditionPolicyService.requiresEnterpriseLicense() ? config.ENVSYNC_LICENSE_MODE : "none",
				certificate_serial_hex: null,
				certificate_fingerprint_sha256: null,
				certificate_subject: null,
				certificate_issuer: null,
				certificate_expires_at: null,
				root_ca_fingerprint_sha256: null,
				validated_at: null,
				created_at: now,
				updated_at: now,
			})
			.onConflict((oc) => oc.column("id").doNothing())
			.execute();

		state = await db
			.selectFrom("license_state")
			.selectAll()
			.where("id", "=", LICENSE_STATE_ID)
			.executeTakeFirstOrThrow();

		return state;
	}

	private static getHeartbeatIntervalMs() {
		return this.#testOverrides?.heartbeat_interval_ms ?? HEARTBEAT_INTERVAL_MS;
	}

	private static getServerUrl() {
		return this.#testOverrides?.server_url ?? config.ENVSYNC_LICENSE_SERVER_URL;
	}

	private static getLicenseKey() {
		return this.#testOverrides?.license_key ?? config.ENVSYNC_LICENSE_KEY ?? "";
	}

	private static getInstallFingerprint() {
		return this.#testOverrides?.install_fingerprint ?? config.ENVSYNC_INSTALL_FINGERPRINT ?? "";
	}

	public static setTestOverrides(overrides: LicenseStateTestOverrides) {
		this.#testOverrides = { ...overrides };
	}

	public static clearTestOverrides() {
		this.#testOverrides = null;
	}

	public static stopHeartbeatForTests() {
		if (this.#heartbeatTimer) {
			clearInterval(this.#heartbeatTimer);
			this.#heartbeatTimer = null;
		}
		this.#heartbeatStarted = false;
	}

	private static async persistCache(state: PersistedLicenseState) {
		await CacheClient.set(
			LICENSE_CACHE_KEY,
			JSON.stringify(state),
			Math.max(1, Math.ceil(this.getHeartbeatIntervalMs() / 1000)),
		);
	}

	public static async getLicenseState(): Promise<PersistedLicenseState> {
		const cached = await CacheClient.get(LICENSE_CACHE_KEY);
		if (cached) {
			return normalizeState(JSON.parse(cached) as Record<string, unknown>);
		}

		const state = await this.ensurePersistedStateRow();
		const normalized = normalizeState(state as unknown as Record<string, unknown>);
		await this.persistCache(normalized);
		return normalized;
	}

	public static async updateLicenseState(data: {
		status?: PersistedLicenseStatus;
		signed_lease?: string | null;
		lease_expires_at?: Date | null;
		fingerprint?: string | null;
		last_verified_at?: Date | null;
		last_error_code?: string | null;
		last_error_message?: string | null;
		validation_mode?: "none" | "lease" | "certificate" | null;
		certificate_serial_hex?: string | null;
		certificate_fingerprint_sha256?: string | null;
		certificate_subject?: string | null;
		certificate_issuer?: string | null;
		certificate_expires_at?: Date | null;
		root_ca_fingerprint_sha256?: string | null;
		validated_at?: Date | null;
	}) {
		const db = await DB.getInstance();
		await this.getLicenseState();
		await this.ensurePersistedStateRow();
		await db
			.updateTable("license_state")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", LICENSE_STATE_ID)
			.executeTakeFirstOrThrow();

		const state = await db
			.selectFrom("license_state")
			.selectAll()
			.where("id", "=", LICENSE_STATE_ID)
			.executeTakeFirstOrThrow();
		const normalized = normalizeState(state as unknown as Record<string, unknown>);
		await this.persistCache(normalized);
		return normalized;
	}

	public static async applyLicenseServerResponse(response: LicenseVerificationResponse) {
		const updated = await this.updateLicenseState({
			status: response.status,
			signed_lease: response.signed_lease ?? null,
			lease_expires_at: toDate(response.lease_expires_at),
			fingerprint: this.getInstallFingerprint() || null,
			last_verified_at: new Date(),
			last_error_code: response.reason_code ?? null,
			last_error_message: response.message ?? null,
			validation_mode: "lease",
		});

		// Phase 4: when license-server returns an entitlement JWT as signed_lease, verify cryptographically.
		if (response.status === "active" && looksLikeJwt(response.signed_lease)) {
			try {
				await EntitlementService.verifyJwt(response.signed_lease, { apply: true });
			} catch {
				// Opaque/legacy signed_lease is not an Ed25519 entitlement JWT yet.
			}
		}

		return updated;
	}

	public static buildLicenseRequest(): LicenseVerificationRequest {
		return {
			license_key: this.getLicenseKey(),
			install_fingerprint: this.getInstallFingerprint(),
			edition: EditionPolicyService.getEdition(),
			root_domain: deriveRootDomain(),
			stack_name: config.ENVSYNC_STACK_NAME,
			release_version: config.ENVSYNC_RELEASE_VERSION,
		};
	}

	public static async activateLicense() {
		if (this.usesEntitlementMode()) {
			return this.validateEntitlementNow();
		}
		if (this.usesCertificateMode()) {
			return this.validateCertificateNow();
		}
		const response = await LicenseServerClient.activate(this.buildLicenseRequest(), this.getServerUrl());
		return this.applyLicenseServerResponse(response);
	}

	public static async verifyLicenseNow() {
		if (this.usesEntitlementMode()) {
			return this.validateEntitlementNow();
		}
		if (this.usesCertificateMode()) {
			return this.validateCertificateNow();
		}
		const response = await LicenseServerClient.verify(this.buildLicenseRequest(), this.getServerUrl());
		return this.applyLicenseServerResponse(response);
	}

	private static usesCertificateMode() {
		return config.ENVSYNC_LICENSE_MODE === "certificate";
	}

	private static usesEntitlementMode() {
		return config.ENVSYNC_LICENSE_MODE === "entitlement";
	}

	public static async validateCertificateNow() {
		const result = await EnterpriseCertificateVerifierService.validateFromEnv();
		return this.applyCertificateValidationResult(result);
	}

	/**
	 * Offline / file-based entitlement JWT (Phase 4). Authority is Ed25519 verify, not DB status.
	 */
	public static async validateEntitlementNow() {
		try {
			const verified = await EntitlementService.resolve();
			if (!verified) {
				return this.updateLicenseState({
					status: "error",
					last_verified_at: new Date(),
					last_error_code: "ENTITLEMENT_REQUIRED",
					last_error_message: "No entitlement JWT configured (ENVSYNC_ENTITLEMENT_JWT or path).",
					validation_mode: "lease",
				});
			}
			return this.updateLicenseState({
				status: "active",
				signed_lease: null,
				lease_expires_at: verified.expires_at,
				fingerprint: verified.claims.install_fingerprint || this.getInstallFingerprint() || null,
				last_verified_at: verified.verified_at,
				last_error_code: verified.in_grace ? "ENTITLEMENT_IN_GRACE" : null,
				last_error_message: verified.in_grace
					? "Entitlement is past exp but within grace window."
					: null,
				validation_mode: "lease",
			});
		} catch (error) {
			return this.updateLicenseState({
				status: "locked",
				last_verified_at: new Date(),
				last_error_code: "ENTITLEMENT_INVALID",
				last_error_message: error instanceof Error ? error.message : String(error),
				validation_mode: "lease",
			});
		}
	}

	public static async applyCertificateValidationResult(result: CertificateValidationResult) {
		const updated = await this.updateLicenseState({
			status: result.status,
			signed_lease: null,
			lease_expires_at: result.expires_at,
			fingerprint: this.getInstallFingerprint() || null,
			last_verified_at: new Date(),
			last_error_code: result.reason_code,
			last_error_message: result.message,
			validation_mode: "certificate",
			certificate_serial_hex: result.serial_hex,
			certificate_fingerprint_sha256: result.certificate_fingerprint_sha256,
			certificate_subject: result.subject,
			certificate_issuer: result.issuer,
			certificate_expires_at: result.expires_at,
			root_ca_fingerprint_sha256: result.root_ca_fingerprint_sha256,
			validated_at: new Date(),
		});

		// Cryptographically validated cert grants default EE feature set (offline air-gap path).
		if (result.status === "active") {
			EntitlementService.applyCertificateClaims({
				install_fingerprint: this.getInstallFingerprint(),
				features: [...DEFAULT_ENTERPRISE_FEATURE_SET],
				expires_at: result.expires_at,
			});
		}

		return updated;
	}

	public static async getEnforcementDecision() {
		if (!EditionPolicyService.requiresEnterpriseLicense()) {
			return {
				required: false,
				locked: false,
				reason: null,
				state: await this.getLicenseState(),
			};
		}

		// Entitlement JWT is primary authority when configured (file/env or mode=entitlement).
		if (this.usesEntitlementMode() || config.ENVSYNC_ENTITLEMENT_JWT || config.ENVSYNC_ENTITLEMENT_JWT_PATH) {
			const state = await this.validateEntitlementNow();
			const locked = state.status !== "active";
			return {
				required: true,
				locked,
				reason: locked ? (state.last_error_code ?? "ENTITLEMENT_INVALID") : null,
				state,
			};
		}

		const state = await this.getLicenseState();

		// Phase 4: if a stored signed_lease looks like a JWT, require crypto verify (blocks forged active+opaque).
		if (looksLikeJwt(state.signed_lease)) {
			try {
				await EntitlementService.verifyJwt(state.signed_lease, { apply: true });
				// Crypto verify succeeded (incl. grace). DB status alone is not authority.
				return {
					required: true,
					locked: false,
					reason: null,
					state: {
						...state,
						status: "active",
					},
				};
			} catch {
				return {
					required: true,
					locked: true,
					reason: "ENTITLEMENT_INVALID",
					state,
				};
			}
		}

		if (this.usesCertificateMode() && state.status === "unknown") {
			const refreshed = await this.validateCertificateNow();
			return this.getEnforcementDecisionFromState(refreshed);
		}

		return this.getEnforcementDecisionFromState(state);
	}

	private static async getEnforcementDecisionFromState(state: PersistedLicenseState) {
		const now = Date.now();
		if (state.validation_mode === "certificate" || this.usesCertificateMode()) {
			const certificateExpiry = state.certificate_expires_at ? new Date(state.certificate_expires_at).getTime() : 0;
			const locked = state.status !== "active" || !certificateExpiry || certificateExpiry <= now;
			const reason = state.status !== "active"
				? state.last_error_code ?? "ENTERPRISE_LICENSE_INVALID"
				: !certificateExpiry || certificateExpiry <= now
					? "LICENSE_CERT_EXPIRED"
					: null;

			// Re-apply claims from validated cert so feature gates work after process restart (cache warm).
			if (!locked && state.status === "active") {
				EntitlementService.applyCertificateClaims({
					install_fingerprint: state.fingerprint ?? this.getInstallFingerprint(),
					features: [...DEFAULT_ENTERPRISE_FEATURE_SET],
					expires_at: state.certificate_expires_at ?? null,
				});
			}

			return {
				required: true,
				locked,
				reason,
				state,
			};
		}

		const leaseExpiry = state.lease_expires_at ? new Date(state.lease_expires_at).getTime() : 0;
		const locked = state.status !== "active" || !leaseExpiry || leaseExpiry <= now;
		const reason = state.status !== "active"
			? state.last_error_code ?? "ENTERPRISE_LICENSE_INVALID"
			: !leaseExpiry || leaseExpiry <= now
				? "ENTERPRISE_LICENSE_EXPIRED"
				: null;

		return {
			required: true,
			locked,
			reason,
			state,
		};
	}

	public static async startHeartbeat() {
		if (this.#heartbeatStarted || !EditionPolicyService.requiresEnterpriseLicense()) {
			return;
		}

		if (this.usesEntitlementMode()) {
			this.#heartbeatStarted = true;
			await this.validateEntitlementNow();
			return;
		}

		if (this.usesCertificateMode()) {
			this.#heartbeatStarted = true;
			await this.validateCertificateNow();
			return;
		}

		if (!this.getServerUrl() || !this.getLicenseKey() || !this.getInstallFingerprint()) {
			await this.updateLicenseState({
				status: "error",
				last_error_code: "LICENSE_CONFIG_MISSING",
				last_error_message: "License enforcement is enabled but the license server configuration is incomplete.",
			});
			return;
		}

		this.#heartbeatStarted = true;
		const refresh = async () => {
			try {
				await this.verifyLicenseNow();
			} catch (error) {
				await this.updateLicenseState({
					status: "error",
					last_verified_at: new Date(),
					last_error_code: "LICENSE_SERVER_UNREACHABLE",
					last_error_message: error instanceof Error ? error.message : String(error),
				});
			}
		};

		await refresh();
		this.#heartbeatTimer = setInterval(() => {
			void refresh();
		}, this.getHeartbeatIntervalMs());
	}
}
