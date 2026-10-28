/**
 * Auth helpers for E2E tests.
 *
 * Uses the same DB seed helpers as mock tests, plus real FGA/KMS clients.
 * Tokens are real JWTs issued by the real Keycloak instance.
 */
import fs from "node:fs";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";

import {
	bootstrapKeycloakClient,
	createKeycloakTestUser,
	getKeycloakAccessToken,
} from "./keycloak-bootstrap";
import { ensureE2EEnv } from "./bootstrap-env";

ensureE2EEnv();

export interface E2EUser {
	id: string;
	token: string;
	email: string;
	authServiceId: string;
}

export interface E2EOrg {
	id: string;
	name: string;
	slug: string;
}

export interface E2ESeed {
	org: E2EOrg;
	masterUser: E2EUser;
	roles: Record<string, { id: string; name: string }>;
}

// ── Keycloak credentials (cached from env) ──────────────────────────

type KeycloakCreds = {
	url: string;
	realm: string;
	adminUser: string;
	adminPassword: string;
	clientId: string;
	clientSecret: string;
};

let keycloakCreds: KeycloakCreds | null = null;
let keycloakCredsPromise: Promise<KeycloakCreds> | null = null;

function getBaseKeycloakCredentials() {
	const url = process.env.ATRIUM_INTERNAL_URL ?? process.env.ATRIUM_PUBLIC_URL;
	const realm = "atrium";
	const adminUser = process.env.ATRIUM_MANAGEMENT_CLIENT_ID ?? "management";
	const adminPassword = process.env.ATRIUM_MANAGEMENT_CLIENT_SECRET;

	if (!url || !adminPassword) {
		throw new Error(
			"Missing Atrium E2E credentials. Ensure ATRIUM_INTERNAL_URL and ATRIUM_MANAGEMENT_CLIENT_SECRET are set. " +
			"Run 'bun run e2e:init' first.",
		);
	}

	return { url, realm, adminUser, adminPassword };
}

function findProjectRoot(): string {
	let dir = path.resolve(import.meta.dir, "../../..");
	for (;;) {
		if (fs.existsSync(path.join(dir, "package.json"))) {
			try {
				const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
				if (pkg.name === "envsync-api") return dir;
			} catch {}
		}
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return path.resolve(import.meta.dir, "../../..");
}

function persistKeycloakClientCredentials(clientId: string, clientSecret: string): void {
	const envPath = path.join(findProjectRoot(), ".env.e2e.test");
	const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
	const lines = existing.length > 0 ? existing.split(/\r?\n/) : [];
	const next = new Map<string, string>([
		["ATRIUM_E2E_CLIENT_ID", clientId],
		["ATRIUM_E2E_CLIENT_SECRET", clientSecret],
	]);

	const updatedLines = lines.map((line) => {
		const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
		if (!match) return line;
		const key = match[1];
		if (!next.has(key)) return line;
		const value = next.get(key)!;
		next.delete(key);
		return `${key}=${value}`;
	});

	for (const [key, value] of next.entries()) {
		updatedLines.push(`${key}=${value}`);
	}

	fs.writeFileSync(envPath, `${updatedLines.filter(Boolean).join("\n")}\n`, "utf8");
}

async function bootstrapAndPersistKeycloakClient(baseCreds: ReturnType<typeof getBaseKeycloakCredentials>): Promise<KeycloakCreds> {
	const client = await bootstrapKeycloakClient(
		baseCreds.url,
		baseCreds.realm,
		baseCreds.adminUser,
		baseCreds.adminPassword,
	);

	process.env.ATRIUM_E2E_CLIENT_ID = client.clientId;
	process.env.ATRIUM_E2E_CLIENT_SECRET = client.clientSecret;
	persistKeycloakClientCredentials(client.clientId, client.clientSecret);

	return {
		...baseCreds,
		clientId: client.clientId,
		clientSecret: client.clientSecret,
	};
}

async function ensureKeycloakCredentials(forceRefresh = false): Promise<KeycloakCreds> {
	if (!forceRefresh && keycloakCreds) return keycloakCreds;
	if (!forceRefresh && keycloakCredsPromise) return keycloakCredsPromise;

	const promise = (async () => {
		const baseCreds = getBaseKeycloakCredentials();
		const clientId = process.env.ATRIUM_E2E_CLIENT_ID;
		const clientSecret = process.env.ATRIUM_E2E_CLIENT_SECRET;

		if (!forceRefresh && clientId && clientSecret) {
			return {
				...baseCreds,
				clientId,
				clientSecret,
			};
		}

		return bootstrapAndPersistKeycloakClient(baseCreds);
	})();

	keycloakCredsPromise = promise;
	try {
		keycloakCreds = await promise;
		return keycloakCreds;
	} finally {
		keycloakCredsPromise = null;
	}
}

function isInvalidClientError(err: unknown): boolean {
	return err instanceof Error && err.message.includes("invalid_client");
}

// ── Seed helpers ────────────────────────────────────────────────────

/**
 * Create a test org with default roles and a master user.
 * Uses the real database and writes real FGA tuples.
 */
export async function seedE2EOrg(): Promise<E2ESeed> {
	const { DB } = await import("@/libs/db");
	const { FGAClient } = await import("@/libs/openfga/index");
	const { CertificateService } = await import("@/services/certificate.service");
	const { CertificateRoleMapper } = await import("@/services/certificate-role.mapper");
	const db = await DB.getInstance();
	const orgId = uuidv4();
	const slug = `e2e-${orgId.slice(0, 8)}`;

	// Create org
	await db
		.insertInto("orgs")
		.values({
			id: orgId,
			name: `E2E Test Org ${slug}`,
			slug,
			metadata: {},
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();

	// Create default roles (table is "org_role", matching mock helper db.ts)
	const DEFAULT_ROLES = [
		{
			key: "master",
			name: "Org Admin",
			is_master: true,
			is_admin: true,
			can_view: true,
			can_edit: true,
			have_api_access: true,
			have_billing_options: true,
			have_webhook_access: true,
			have_gpg_access: true,
			have_cert_access: true,
			have_audit_access: true,
			color: "#FF5733",
		},
		{
			key: "admin",
			name: "Billing Admin",
			is_admin: false,
			is_master: false,
			can_view: false,
			can_edit: false,
			have_api_access: false,
			have_billing_options: true,
			have_webhook_access: false,
			have_gpg_access: false,
			have_cert_access: false,
			have_audit_access: false,
			color: "#33FF57",
		},
		{
			key: "developer",
			name: "Developer",
			is_admin: false,
			is_master: false,
			can_view: true,
			can_edit: true,
			have_api_access: false,
			have_billing_options: false,
			have_webhook_access: false,
			have_gpg_access: false,
			have_cert_access: false,
			have_audit_access: false,
			color: "#572F13",
		},
		{
			key: "viewer",
			name: "Viewer",
			is_admin: false,
			is_master: false,
			can_view: true,
			can_edit: false,
			have_api_access: false,
			have_billing_options: false,
			have_webhook_access: false,
			have_gpg_access: false,
			have_cert_access: false,
			have_audit_access: false,
			color: "#FF33A1",
		},
	] as const;

	const roles: Record<string, { id: string; name: string }> = {};
	for (const roleDef of DEFAULT_ROLES) {
		const id = uuidv4();
		const { key, ...values } = roleDef;
		await db
			.insertInto("org_role")
			.values({
				id,
				...values,
				org_id: orgId,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();
		roles[key] = { id, name: roleDef.name };
	}

	// Create master user
	const masterUser = await seedE2EUser(orgId, roles.master.id);

	// Initialize org CA and issue member cert for master user
	await CertificateService.initOrgCA(orgId, `E2E Test Org ${slug}`, masterUser.id);
	await CertificateService.issueMemberCert({
		org_id: orgId,
		target_user_id: masterUser.id,
		target_email: masterUser.email,
		issued_by_user_id: masterUser.id,
		envsync_pki_role: "master",
		is_system_generated: true,
		persist_private_key: true,
		description: "E2E seeded master certificate",
		metadata: {
			role_id: roles.master.id,
			role_name: roles.master.name,
			issued_source: "e2e_seed",
		},
	});

	// Write FGA tuples for master user with full permissions
	const fga = await FGAClient.getInstance();
	const userRef = `user:${masterUser.id}`;
	const orgRef = `org:${orgId}`;

	await fga.writeTuples([
		{ user: userRef, relation: "member", object: orgRef },
		{ user: userRef, relation: "master", object: orgRef },
		{ user: userRef, relation: "admin", object: orgRef },
		{ user: userRef, relation: "can_view", object: orgRef },
		{ user: userRef, relation: "can_edit", object: orgRef },
		{ user: userRef, relation: "have_api_access", object: orgRef },
	]);
	await fga.writeTuples([
		{ user: userRef, relation: "have_billing_options", object: orgRef },
		{ user: userRef, relation: "have_webhook_access", object: orgRef },
	]);

	return { org: { id: orgId, name: `E2E Test Org ${slug}`, slug }, masterUser, roles };
}

/**
 * Create a test user in an org with a given role.
 * Creates a real user in Keycloak and obtains a real JWT.
 */
export async function seedE2EUser(
	orgId: string,
	roleId: string,
): Promise<E2EUser> {
	let creds = await ensureKeycloakCredentials();
	const { CertificateService } = await import("@/services/certificate.service");
	const { CertificateRoleMapper } = await import("@/services/certificate-role.mapper");
	const { RoleService } = await import("@/services/role.service");
	const { DB } = await import("@/libs/db");
	const db = await DB.getInstance();
	const id = uuidv4();
	const email = `e2e-${id.slice(0, 8)}@test.local`;
	const password = "E2eTest1!strong";

	const keycloakUser = await createKeycloakTestUser(creds.url, creds.realm, creds.adminUser, creds.adminPassword, {
		email,
		firstName: "E2E",
		lastName: `User ${id.slice(0, 8)}`,
		password,
	});

	await db
		.insertInto("users")
		.values({
			id,
			email,
			full_name: `E2E User ${id.slice(0, 8)}`,
			auth_service_id: keycloakUser.keycloakUserId,
			org_id: orgId,
			role_id: roleId,
			is_active: true,
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();

	// 3. Get real JWT access token from Keycloak
	let token: string;
	try {
		token = await getKeycloakAccessToken(
			creds.url,
			creds.realm,
			creds.clientId,
			creds.clientSecret,
			email,
			password,
		);
	} catch (err) {
		if (!isInvalidClientError(err)) {
			throw err;
		}

		creds = await ensureKeycloakCredentials(true);
		token = await getKeycloakAccessToken(
			creds.url,
			creds.realm,
			creds.clientId,
			creds.clientSecret,
			email,
			password,
		);
	}

	// 4. Issue member cert if org CA is already initialized
	//    (skipped for the master user created inside seedE2EOrg — their cert
	//     is issued explicitly after org CA init)
	const orgCA = await CertificateService.getOrgCA(orgId);
	if (orgCA) {
		const role = await RoleService.getRole(roleId);
		await CertificateService.issueMemberCert({
			org_id: orgId,
			target_user_id: id,
			target_email: email,
			issued_by_user_id: id,
			envsync_pki_role: CertificateRoleMapper.toPkiRole(role),
			is_system_generated: true,
			persist_private_key: true,
			description: "E2E seeded member certificate",
			metadata: {
				role_id: role.id,
				role_name: role.name,
				issued_source: "e2e_seed",
			},
		});
	}

	return {
		id,
		token,
		email,
		authServiceId: keycloakUser.keycloakUserId,
	};
}

/**
 * Convenience: write FGA tuples for a user based on role flags.
 */
export async function setupE2EUserPermissions(
	userId: string,
	orgId: string,
	flags: {
		is_master?: boolean;
		is_admin?: boolean;
		can_view?: boolean;
		can_edit?: boolean;
		have_api_access?: boolean;
		have_billing_options?: boolean;
		have_webhook_access?: boolean;
	},
): Promise<void> {
	const { FGAClient } = await import("@/libs/openfga/index");
	const fga = await FGAClient.getInstance();
	const user = `user:${userId}`;
	const org = `org:${orgId}`;

	const tuples: { user: string; relation: string; object: string }[] = [
		{ user, relation: "member", object: org },
	];

	if (flags.is_master) tuples.push({ user, relation: "master", object: org });
	if (flags.is_admin) tuples.push({ user, relation: "admin", object: org });
	if (flags.can_view) tuples.push({ user, relation: "can_view", object: org });
	if (flags.can_edit) tuples.push({ user, relation: "can_edit", object: org });
	if (flags.have_api_access) tuples.push({ user, relation: "have_api_access", object: org });
	if (flags.have_billing_options) tuples.push({ user, relation: "have_billing_options", object: org });
	if (flags.have_webhook_access) tuples.push({ user, relation: "have_webhook_access", object: org });

	// FGA limits to 10 tuples per write
	for (let i = 0; i < tuples.length; i += 10) {
		await fga.writeTuples(tuples.slice(i, i + 10));
	}
}

/**
 * Check service health before running E2E tests.
 * Throws if any required service is unreachable.
 */
export async function checkServiceHealth(): Promise<void> {
	const { DB } = await import("@/libs/db");
	const { FGAClient } = await import("@/libs/openfga/index");
	const { KMSClient } = await import("@/libs/kms/client");
	const checks = [
		{
			name: "PostgreSQL",
			check: async () => {
				const db = await DB.getInstance();
				await db.selectFrom("orgs").select("id").limit(1).execute();
			},
		},
		{
			name: "OpenFGA",
			check: async () => {
				const fga = await FGAClient.getInstance();
				await fga.healthCheck();
			},
		},
		{
			name: "Atrium",
			check: async () => {
				const url = (process.env.ATRIUM_INTERNAL_URL ?? "http://localhost:8080").replace(/\/$/, "");
				const res = await fetch(`${url}/health`, {
					signal: AbortSignal.timeout(5000),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
			},
		},
		{
			name: "miniKMS",
			check: async () => {
				const kms = await KMSClient.getInstance();
				const healthy = await kms.healthCheck();
				if (!healthy) throw new Error("miniKMS health check returned non-SERVING status");
			},
		},
	];

	for (const { name, check } of checks) {
		try {
			await check();
		} catch (err) {
			throw new Error(
				`E2E prerequisite failed: ${name} is not reachable. ` +
					`Ensure docker-compose services are running. ` +
					`Error: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
}
