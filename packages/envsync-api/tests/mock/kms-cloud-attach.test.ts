import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { CmkCloudProvider } from "envsync-enterprise/services/cmk-cloud.provider.ts";
import { CmkCredentialService } from "envsync-enterprise/services/cmk-credential.service.ts";
import { CmkRewrapWorker } from "envsync-enterprise/services/cmk-rewrap.worker.ts";
import { CmkService, registerCmkTenantWrappingProvider } from "envsync-enterprise/services/cmk.service.ts";

import { AppError } from "@/libs/errors";
import { KMSClient } from "@/libs/kms/client";
import { EditionPolicyService } from "@/services/edition-policy.service";
import { OrgFeatureGrantService } from "@/services/org-feature-grant.service";

import { cleanupDB, getDB, seedOrg, type SeedOrgResult } from "../helpers/db";
import { resetFGA, setupUserOrgTuples } from "../helpers/fga";
import { resetMockKmsTenantWrapping, resetVaultStore, setMockKmsTenantRewrap } from "../helpers/kms";
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

function createTestCloudAdapter(options?: { failUnwrap?: boolean; onWrap?: () => void; onUnwrap?: () => void }) {
	const key = createHash("sha256").update("envsync-test-cmk").digest();
	return {
		wrap: async ({ plaintext }: { plaintext: Buffer }) => {
			options?.onWrap?.();
			const iv = randomBytes(12);
			const cipher = createCipheriv("aes-256-gcm", key, iv);
			const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
			return Buffer.concat([iv, cipher.getAuthTag(), enc]);
		},
		unwrap: async ({ ciphertext }: { ciphertext: Buffer }) => {
			options?.onUnwrap?.();
			if (options?.failUnwrap) {
				throw new Error("AccessDeniedException");
			}
			const iv = ciphertext.subarray(0, 12);
			const tag = ciphertext.subarray(12, 28);
			const enc = ciphertext.subarray(28);
			const decipher = createDecipheriv("aes-256-gcm", key, iv);
			decipher.setAuthTag(tag);
			return Buffer.concat([decipher.update(enc), decipher.final()]);
		},
	};
}

async function seedHostedCloudConfig() {
	EditionPolicyService.setTestOverrides({
		edition: "enterprise",
		deployment_mode: "hosted",
	});
	const cred = await CmkCredentialService.create({
		org_id: seed.org.id,
		key: "aws-cmk",
		value: JSON.stringify({ access_key_id: "AKIATEST", secret_access_key: "secret" }),
	});
	await CmkService.updateConfig(seed.org.id, {
		source: "aws-kms",
		key_ref: "arn:aws:kms:us-east-1:123:key/test",
		region: "us-east-1",
		credential_secret_id: cred.id,
	});
	return cred;
}

beforeEach(async () => {
	await cleanupDB();
	resetFGA();
	resetVaultStore();
	resetMockKmsTenantWrapping();
	CmkRewrapWorker.stop();
	CmkCloudProvider.setTestAdapter(null);
	CmkService.clearKekCache();
	EditionPolicyService.clearTestOverrides();
	OrgFeatureGrantService.clearTestOverrides();

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
	CmkRewrapWorker.staleRunningMs = 2 * 60 * 60 * 1000;
	KMSClient.setTenantWrappingProvider(null);
	resetMockKmsTenantWrapping();
	CmkCloudProvider.setTestAdapter(null);
	CmkService.clearKekCache();
	EditionPolicyService.clearTestOverrides();
	OrgFeatureGrantService.clearTestOverrides();
});

describe("Hosted CMK cloud attach", () => {
	test("self-host attach returns CMK_HOSTED_ONLY", async () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "selfhosted",
		});
		const db = await getDB();
		await db
			.insertInto("org_kms_config")
			.values({
				org_id: seed.org.id,
				source: "aws-kms",
				status: "pending",
				key_ref: "arn:aws:kms:us-east-1:123:key/test",
				region: "us-east-1",
				credential_secret_id: null,
				wrapped_kek: null,
				kek_version: 1,
				last_verified_at: null,
				last_error: null,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();

		const res = await testRequest("/api/v1/manage/kms/attach", {
			method: "POST",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ code: "CMK_HOSTED_ONLY" });
	});

	test("dual-unwrap attach window then clears the flag", async () => {
		await seedHostedCloudConfig();
		CmkCloudProvider.setTestAdapter(createTestCloudAdapter());

		const calls: string[] = [];
		setMockKmsTenantRewrap({
			supports: true,
			setWrapping: async input => {
				calls.push(`set:${input.allowRootUnwrap ? "dual" : "kek-only"}`);
			},
			rewrap: async input => {
				calls.push(`rewrap:${input.target}:${input.allowRootUnwrap ? "dual" : "off"}`);
			},
		});

		const res = await testRequest("/api/v1/manage/kms/attach", {
			method: "POST",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(202);
		const job = await res.json();
		expect(job).toMatchObject({
			kind: "dek_rewrap",
			status: "pending",
			progress: { allow_root_unwrap: true, target: "TENANT_KEK" },
		});
		expect(await CmkService.getConfig(seed.org.id)).toMatchObject({ status: "rotating" });

		await CmkRewrapWorker.processPendingJobs();
		const finished = await CmkService.getJob(seed.org.id, job.id);
		expect(finished.status).toBe("succeeded");
		expect(calls).toEqual(["set:dual", "rewrap:TENANT_KEK:dual", "set:kek-only"]);
		expect(await CmkService.getConfig(seed.org.id)).toMatchObject({
			source: "aws-kms",
			status: "active",
			last_error: null,
		});
	});

	test("encrypt still works during rotating dual-unwrap window", async () => {
		await seedHostedCloudConfig();
		CmkCloudProvider.setTestAdapter(createTestCloudAdapter());
		await CmkService.verify(seed.org.id);
		const db = await getDB();
		await db
			.updateTable("org_kms_config")
			.set({ status: "rotating", updated_at: new Date() })
			.where("org_id", "=", seed.org.id)
			.execute();

		const wrapping: boolean[] = [];
		setMockKmsTenantRewrap({
			supports: true,
			setWrapping: async input => {
				wrapping.push(Boolean(input.allowRootUnwrap));
			},
		});

		const kms = await KMSClient.getInstance();
		const enc = await kms.encrypt(seed.org.id, "app-1", "during-attach", "aad");
		const dec = await kms.decrypt(seed.org.id, "app-1", enc.ciphertext, "aad", enc.keyVersionId);
		expect(dec.plaintext).toBe("during-attach");
		expect(wrapping).toContain(true);
	});

	test("fail closed after attach when the CMK unwraps fail", async () => {
		await seedHostedCloudConfig();
		CmkCloudProvider.setTestAdapter(createTestCloudAdapter());
		setMockKmsTenantRewrap({
			supports: true,
			rewrap: async () => {},
			setWrapping: async () => {},
		});
		const job = await CmkService.attach(seed.org.id, seed.masterUser.id);
		await CmkRewrapWorker.processPendingJobs();
		expect((await CmkService.getJob(seed.org.id, job.id)).status).toBe("succeeded");

		CmkService.clearKekCache();
		CmkCloudProvider.setTestAdapter(createTestCloudAdapter({ failUnwrap: true }));

		const kms = await KMSClient.getInstance();
		await expect(kms.encrypt(seed.org.id, "app-1", "secret", "aad")).rejects.toMatchObject({
			code: "CMK_UNAVAILABLE",
			statusCode: 503,
		});
		await expect(kms.decrypt(seed.org.id, "app-1", "x", "aad", "kv")).rejects.toMatchObject({
			code: "CMK_UNAVAILABLE",
		});
		expect(await CmkService.getConfig(seed.org.id)).toMatchObject({
			source: "aws-kms",
			status: "unavailable",
		});
	});

	test("losing the kms grant does not brick existing cloud unwrap", async () => {
		await seedHostedCloudConfig();
		CmkCloudProvider.setTestAdapter(createTestCloudAdapter());
		setMockKmsTenantRewrap({
			supports: true,
			rewrap: async () => {},
			setWrapping: async () => {},
		});
		const job = await CmkService.attach(seed.org.id, seed.masterUser.id);
		await CmkRewrapWorker.processPendingJobs();
		expect((await CmkService.getJob(seed.org.id, job.id)).status).toBe("succeeded");

		OrgFeatureGrantService.setTestOverrides({ grant: hostedGrant(["saml"]) });
		CmkService.clearKekCache();

		const kms = await KMSClient.getInstance();
		const enc = await kms.encrypt(seed.org.id, "app-1", "still-works", "aad");
		expect((await kms.decrypt(seed.org.id, "app-1", enc.ciphertext, "aad", enc.keyVersionId)).plaintext).toBe(
			"still-works",
		);

		const denied = await testRequest("/api/v1/manage/kms/attach", {
			method: "POST",
			token: seed.masterUser.token,
		});
		expect(denied.status).toBe(403);
		expect(await denied.json()).toMatchObject({ code: "ORG_FEATURE_MISSING" });
	});

	test("break-glass with deleted CMK still rewraps when sidecar KEK is present", async () => {
		await seedHostedCloudConfig();
		CmkCloudProvider.setTestAdapter(createTestCloudAdapter());
		setMockKmsTenantRewrap({
			supports: true,
			rewrap: async () => {},
			setWrapping: async () => {},
		});
		const attach = await CmkService.attach(seed.org.id, seed.masterUser.id);
		await CmkRewrapWorker.processPendingJobs();
		expect((await CmkService.getJob(seed.org.id, attach.id)).status).toBe("succeeded");

		await CmkService.markUnavailable(seed.org.id, "AccessDeniedException");
		let unwraps = 0;
		CmkCloudProvider.setTestAdapter(
			createTestCloudAdapter({
				failUnwrap: true,
				onUnwrap: () => {
					unwraps += 1;
				},
			}),
		);

		const sidecar: string[] = [];
		setMockKmsTenantRewrap({
			supports: true,
			rewrap: async input => {
				sidecar.push(`rewrap:${input.target}`);
			},
			clear: async () => {
				sidecar.push("clear");
			},
			setWrapping: async () => {
				sidecar.push("set");
			},
		});

		const job = await CmkService.breakGlassDetach(seed.org.id, "platform");
		expect(job.progress).toMatchObject({ allow_warmup: false });
		await CmkRewrapWorker.processPendingJobs();
		const finished = await CmkService.getJob(seed.org.id, job.id);
		expect(finished.status).toBe("succeeded");
		expect(sidecar).toEqual(["rewrap:ROOT", "clear"]);
		expect(unwraps).toBe(0);
		expect(await CmkService.getConfig(seed.org.id)).toMatchObject({ source: "managed", status: "active" });
	});

	test("healthy detach warms the sidecar from cloud before rewrap-to-root", async () => {
		await seedHostedCloudConfig();
		CmkCloudProvider.setTestAdapter(createTestCloudAdapter());
		setMockKmsTenantRewrap({
			supports: true,
			rewrap: async () => {},
			setWrapping: async () => {},
		});
		const attach = await CmkService.attach(seed.org.id, seed.masterUser.id);
		await CmkRewrapWorker.processPendingJobs();
		expect((await CmkService.getJob(seed.org.id, attach.id)).status).toBe("succeeded");

		const sidecar: string[] = [];
		setMockKmsTenantRewrap({
			supports: true,
			setWrapping: async input => {
				sidecar.push(`set:${input.allowRootUnwrap ? "dual" : "kek-only"}`);
			},
			rewrap: async input => {
				sidecar.push(`rewrap:${input.target}`);
			},
			clear: async () => {
				sidecar.push("clear");
			},
		});

		const job = await CmkService.detach(seed.org.id, seed.masterUser.id);
		expect(job.progress).toMatchObject({ allow_warmup: true });
		await CmkRewrapWorker.processPendingJobs();
		expect((await CmkService.getJob(seed.org.id, job.id)).status).toBe("succeeded");
		expect(sidecar).toEqual(["set:kek-only", "rewrap:ROOT", "clear"]);
		expect(await CmkService.getConfig(seed.org.id)).toMatchObject({ source: "managed", status: "active" });
	});

	test("verify first-wraps a tenant KEK and rotate-kek rewraps it", async () => {
		await seedHostedCloudConfig();
		let wraps = 0;
		CmkCloudProvider.setTestAdapter(
			createTestCloudAdapter({
				onWrap: () => {
					wraps += 1;
				},
			}),
		);

		const verified = await CmkService.verify(seed.org.id);
		expect(verified.ok).toBe(true);
		expect(wraps).toBe(1);
		const afterVerify = await CmkService.loadRow(seed.org.id);
		expect(afterVerify?.wrapped_kek && afterVerify.wrapped_kek.length > 0).toBe(true);

		await CmkService.rotateKek(seed.org.id);
		expect(wraps).toBe(2);
	});

	test("failed attach job stays on previous pending source", async () => {
		await seedHostedCloudConfig();
		CmkCloudProvider.setTestAdapter(createTestCloudAdapter());
		setMockKmsTenantRewrap({
			supports: true,
			setWrapping: async () => {},
			rewrap: async () => {
				throw new AppError("rewrap exploded", 500, "KMS_JOB_FAILED");
			},
		});

		const job = await CmkService.attach(seed.org.id, seed.masterUser.id);
		expect(await CmkService.getConfig(seed.org.id)).toMatchObject({ status: "rotating" });
		await CmkRewrapWorker.processPendingJobs();
		expect((await CmkService.getJob(seed.org.id, job.id)).status).toBe("failed");
		expect(await CmkService.getConfig(seed.org.id)).toMatchObject({
			source: "aws-kms",
			status: "pending",
		});
	});

	test("invalid cloud credential JSON is rejected before a provider SDK is used", async () => {
		await expect(
			CmkCloudProvider.wrap({
				source: "aws-kms",
				keyRef: "arn:aws:kms:us-east-1:123:key/test",
				region: "us-east-1",
				credentials: "not-json",
				plaintext: randomBytes(32),
			}),
		).rejects.toMatchObject({ code: "CMK_CREDENTIAL_INVALID" });
		await expect(
			CmkCloudProvider.wrap({
				source: "gcp-kms",
				keyRef: "projects/p/locations/us/keyRings/r/cryptoKeys/k",
				credentials: JSON.stringify({ type: "user" }),
				plaintext: randomBytes(32),
			}),
		).rejects.toMatchObject({ code: "CMK_CREDENTIAL_INVALID" });
		await expect(
			CmkCloudProvider.wrap({
				source: "azure-kv",
				keyRef: "https://vault.vault.azure.net/keys/cmk",
				credentials: JSON.stringify({ tenant_id: "t" }),
				plaintext: randomBytes(32),
			}),
		).rejects.toMatchObject({ code: "CMK_CREDENTIAL_INVALID" });
	});
});
