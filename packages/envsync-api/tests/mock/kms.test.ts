import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { registerCmkTenantWrappingProvider } from "envsync-enterprise/services/cmk.service.ts";
import { CmkService } from "envsync-enterprise/services/cmk.service.ts";
import { CmkCredentialService } from "envsync-enterprise/services/cmk-credential.service.ts";
import { CmkRewrapWorker } from "envsync-enterprise/services/cmk-rewrap.worker.ts";

import { AppError } from "@/libs/errors";
import { KMSClient } from "@/libs/kms/client";
import { EditionPolicyService } from "@/services/edition-policy.service";
import { OrgFeatureGrantService } from "@/services/org-feature-grant.service";
import { config } from "@/utils/env";

import { cleanupDB, getDB, seedApp, seedOrg, type SeedOrgResult } from "../helpers/db";
import { resetFGA, setupUserOrgTuples } from "../helpers/fga";
import {
	resetMockKmsTenantWrapping,
	resetVaultStore,
	setMockKmsTenantRewrap,
} from "../helpers/kms";
import { testRequest } from "../helpers/request";

let seed: SeedOrgResult;

function hostedGrant(features: string[]) {
	return {
		org_id: seed.org.id,
		features,
		source: "seed",
		updated_by: "test",
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	};
}

async function insertCloudConfig(status: "active" | "pending" | "unavailable" | "rotating" = "unavailable") {
	const db = await getDB();
	await db
		.insertInto("org_kms_config")
		.values({
			org_id: seed.org.id,
			source: "aws-kms",
			status,
			key_ref: "arn:aws:kms:us-east-1:123:key/test",
			region: "us-east-1",
			credential_secret_id: null,
			wrapped_kek: null,
			kek_version: 1,
			last_verified_at: null,
			last_error: status === "unavailable" ? "access denied" : null,
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();
}

beforeEach(async () => {
	await cleanupDB();
	resetFGA();
	resetVaultStore();
	resetMockKmsTenantWrapping();
	CmkRewrapWorker.stop();
	EditionPolicyService.clearTestOverrides();
	OrgFeatureGrantService.clearTestOverrides();
	KMSClient.setTenantWrappingProvider(null);

	seed = await seedOrg();
	setupUserOrgTuples(seed.masterUser.id, seed.org.id, {
		is_master: true,
		is_admin: true,
		can_view: true,
		can_edit: true,
		have_api_access: true,
		have_billing_options: true,
		have_webhook_access: true,
	});
	registerCmkTenantWrappingProvider();
});

afterEach(() => {
	CmkRewrapWorker.stop();
	KMSClient.setTenantWrappingProvider(null);
	resetMockKmsTenantWrapping();
	EditionPolicyService.clearTestOverrides();
	OrgFeatureGrantService.clearTestOverrides();
	delete (config as { ENVSYNC_PLATFORM_ADMIN_TOKEN?: string }).ENVSYNC_PLATFORM_ADMIN_TOKEN;
});

describe("Enterprise CMK managed default", () => {
	test("GET /api/v1/manage/kms returns implicit managed/active when no row exists", async () => {
		const res = await testRequest("/api/v1/manage/kms", { token: seed.masterUser.token });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			org_id: seed.org.id,
			source: "managed",
			status: "active",
			implicit: true,
			key_ref: null,
		});
	});

	test("PUT managed persists an explicit managed row", async () => {
		const res = await testRequest("/api/v1/manage/kms", {
			method: "PUT",
			token: seed.masterUser.token,
			body: { source: "managed" },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			source: "managed",
			status: "active",
			implicit: false,
		});
	});

	test("self-host cloud PUT returns CMK_HOSTED_ONLY", async () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "selfhosted",
		});
		const res = await testRequest("/api/v1/manage/kms", {
			method: "PUT",
			token: seed.masterUser.token,
			body: { source: "aws-kms", key_ref: "arn:aws:kms:us-east-1:123:key/x" },
		});
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ code: "CMK_HOSTED_ONLY" });
	});

	test("POST /credentials encrypts under __kms_config__ and never returns the value", async () => {
		const res = await testRequest("/api/v1/manage/kms/credentials", {
			method: "POST",
			token: seed.masterUser.token,
			body: { key: "aws-prod", value: "super-secret-access-key", description: "prod" },
		});
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body).toMatchObject({ key: "aws-prod", configured: true });
		expect(body).not.toHaveProperty("value");

		const db = await getDB();
		const stored = await db.selectFrom("org_secret").selectAll().where("id", "=", body.id).executeTakeFirstOrThrow();
		expect(stored.value).not.toContain("super-secret-access-key");
		expect(JSON.parse(stored.value).ciphertext).toBeString();
		expect((stored.metadata as { purpose?: string }).purpose).toBe("kms");

		const plaintext = await CmkCredentialService.decryptValue(seed.org.id, body.id);
		expect(plaintext).toBe("super-secret-access-key");
	});
});

describe("KMSClient tenant wrapping provider", () => {
	test("skips the provider when scope_id is __kms_config__", async () => {
		await insertCloudConfig("unavailable");
		const kms = await KMSClient.getInstance();
		const enc = await kms.encrypt(seed.org.id, "__kms_config__", "credential", "aad");
		const dec = await kms.decrypt(seed.org.id, "__kms_config__", enc.ciphertext, "aad", enc.keyVersionId);
		expect(dec.plaintext).toBe("credential");
	});

	test("unwrap fails closed with 503 CMK_UNAVAILABLE for tenant scopes", async () => {
		await insertCloudConfig("unavailable");
		const kms = await KMSClient.getInstance();
		try {
			await kms.encrypt(seed.org.id, "app-1", "secret", "aad");
			throw new Error("expected CMK_UNAVAILABLE");
		} catch (error) {
			expect(error).toBeInstanceOf(AppError);
			expect(error).toMatchObject({ code: "CMK_UNAVAILABLE", statusCode: 503 });
		}
	});

	test("grant loss still decrypts existing managed crypto", async () => {
		OrgFeatureGrantService.setTestOverrides({ grant: hostedGrant(["saml"]) });
		const kms = await KMSClient.getInstance();
		const enc = await kms.encrypt(seed.org.id, "app-1", "still-works", "aad");
		const dec = await kms.decrypt(seed.org.id, "app-1", enc.ciphertext, "aad", enc.keyVersionId);
		expect(dec.plaintext).toBe("still-works");
		await expect(CmkService.ensureTenantKek(seed.org.id)).resolves.toBeUndefined();
	});
});

describe("CMK break-glass + single-flight worker", () => {
	test("break-glass does not call ensureTenantKek when status is unavailable", async () => {
		await insertCloudConfig("unavailable");
		let ensureCalls = 0;
		const original = CmkService.ensureTenantKek.bind(CmkService);
		CmkService.ensureTenantKek = async (orgId: string) => {
			ensureCalls += 1;
			return original(orgId);
		};

		try {
			const job = await CmkService.breakGlassDetach(seed.org.id, "platform");
			expect(job.kind).toBe("detach_managed");
			expect(job.status).toBe("pending");
			expect(job.progress).toMatchObject({ allow_warmup: false });

			await CmkRewrapWorker.processPendingJobs();
			const finished = await CmkService.getJob(seed.org.id, job.id);
			expect(finished.status).toBe("failed");
			expect(finished.error_message).toContain("CMK_SIDECAR_RPC_UNAVAILABLE");
			expect(ensureCalls).toBe(0);
		} finally {
			CmkService.ensureTenantKek = original;
		}
	});

	test("break-glass with sidecar KEK missing records CMK_BREAK_GLASS_KEK_MISSING", async () => {
		await insertCloudConfig("unavailable");
		setMockKmsTenantRewrap({
			supports: true,
			rewrap: async () => {
				throw new AppError(
					"Sidecar has no persisted tenant wrapping key for this organization.",
					503,
					"CMK_BREAK_GLASS_KEK_MISSING",
				);
			},
		});

		const job = await CmkService.breakGlassDetach(seed.org.id, "platform");
		await CmkRewrapWorker.processPendingJobs();
		const finished = await CmkService.getJob(seed.org.id, job.id);
		expect(finished.status).toBe("failed");
		expect(finished.error_message).toContain("CMK_BREAK_GLASS_KEK_MISSING");
	});

	test("successful rewrap-to-root clears cloud config back to managed", async () => {
		await insertCloudConfig("unavailable");
		const calls: string[] = [];
		setMockKmsTenantRewrap({
			supports: true,
			rewrap: async input => {
				calls.push(`rewrap:${input.target}`);
			},
			clear: async () => {
				calls.push("clear");
			},
		});

		const job = await CmkService.breakGlassDetach(seed.org.id, "platform");
		await CmkRewrapWorker.processPendingJobs();
		const finished = await CmkService.getJob(seed.org.id, job.id);
		expect(finished.status).toBe("succeeded");
		expect(calls).toEqual(["rewrap:ROOT", "clear"]);

		const config = await CmkService.getConfig(seed.org.id);
		expect(config).toMatchObject({ source: "managed", status: "active", key_ref: null });
	});

	test("unique active job index blocks a second detach (single-flight)", async () => {
		await insertCloudConfig("active");
		const first = await CmkService.detach(seed.org.id, seed.masterUser.id);
		expect(first.status).toBe("pending");
		try {
			await CmkService.detach(seed.org.id, seed.masterUser.id);
			throw new Error("expected KMS_JOB_IN_PROGRESS");
		} catch (error) {
			expect(error).toMatchObject({ code: "KMS_JOB_IN_PROGRESS", statusCode: 409 });
		}
	});

	test("platform break-glass route uses the platform token and skips ensureTenantKek", async () => {
		await insertCloudConfig("unavailable");
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "hosted",
		});
		(config as { ENVSYNC_PLATFORM_ADMIN_TOKEN?: string }).ENVSYNC_PLATFORM_ADMIN_TOKEN = "platform-token";

		let ensureCalls = 0;
		const original = CmkService.ensureTenantKek.bind(CmkService);
		CmkService.ensureTenantKek = async (orgId: string) => {
			ensureCalls += 1;
			return original(orgId);
		};

		try {
			const res = await testRequest(`/api/v1/manage/kms/${seed.org.id}/break-glass-detach`, {
				method: "POST",
				headers: { "X-EnvSync-Platform-Token": "platform-token" },
			});
			expect(res.status).toBe(202);
			expect(await res.json()).toMatchObject({
				kind: "detach_managed",
				status: "pending",
				progress: { allow_warmup: false },
			});
			expect(ensureCalls).toBe(0);
		} finally {
			CmkService.ensureTenantKek = original;
		}
	});
});

describe("CMK grant gate", () => {
	test("losing kms grant blocks new attach but not managed decrypt", async () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "hosted",
		});
		OrgFeatureGrantService.setTestOverrides({ grant: hostedGrant(["saml"]) });

		const denied = await testRequest("/api/v1/manage/kms", {
			method: "PUT",
			token: seed.masterUser.token,
			body: { source: "aws-kms", key_ref: "arn:aws:kms:us-east-1:123:key/x" },
		});
		expect(denied.status).toBe(403);
		expect(await denied.json()).toMatchObject({ code: "ORG_FEATURE_MISSING" });

		const kms = await KMSClient.getInstance();
		const enc = await kms.encrypt(seed.org.id, "app-1", "plain", "aad");
		const dec = await kms.decrypt(seed.org.id, "app-1", enc.ciphertext, "aad", enc.keyVersionId);
		expect(dec.plaintext).toBe("plain");
	});

	test("GET /apps returns GetKeyInfo per app", async () => {
		await seedApp(seed.org.id, { name: "api" });
		const res = await testRequest("/api/v1/manage/kms/apps", { token: seed.masterUser.token });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.apps).toEqual([
			expect.objectContaining({ name: "api", status: "active", key_version_id: "mock-kv" }),
		]);
	});
});
