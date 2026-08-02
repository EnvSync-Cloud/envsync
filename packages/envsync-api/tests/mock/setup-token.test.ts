import { afterEach, describe, expect, test } from "bun:test";

import { EditionPolicyService } from "@/services/edition-policy.service";
import { setupTokenMiddleware } from "@/middlewares/setup-token.middleware";
import { config } from "@/utils/env";

afterEach(() => {
	EditionPolicyService.clearTestOverrides();
	delete (config as { ENVSYNC_SETUP_TOKEN?: string }).ENVSYNC_SETUP_TOKEN;
});

function mockCtx(headers: Record<string, string>) {
	const state: { status?: number; body?: unknown } = {};
	const ctx = {
		req: {
			header: (name: string) => headers[name] ?? headers[name.toLowerCase()],
		},
		json: (body: unknown, status: number) => {
			state.status = status;
			state.body = body;
			return body;
		},
	};
	return { ctx: ctx as never, state };
}

describe("setupTokenMiddleware", () => {
	test("rejects hosted deployment mode", async () => {
		EditionPolicyService.setTestOverrides({ deployment_mode: "hosted", edition: "enterprise" });
		(config as { ENVSYNC_SETUP_TOKEN?: string }).ENVSYNC_SETUP_TOKEN = "es_setup_testtoken1234567890ab";
		const mw = setupTokenMiddleware();
		const { ctx, state } = mockCtx({ "X-EnvSync-Setup-Token": "es_setup_testtoken1234567890ab" });
		let nextCalled = false;
		await mw(ctx, async () => {
			nextCalled = true;
		});
		expect(nextCalled).toBe(false);
		expect(state.status).toBe(403);
		expect((state.body as { code?: string }).code).toBe("SETUP_SELFHOSTED_ONLY");
	});

	test("rejects missing token on selfhosted", async () => {
		EditionPolicyService.setTestOverrides({ deployment_mode: "selfhosted", edition: "oss" });
		(config as { ENVSYNC_SETUP_TOKEN?: string }).ENVSYNC_SETUP_TOKEN = "es_setup_testtoken1234567890ab";
		const mw = setupTokenMiddleware();
		const { ctx, state } = mockCtx({});
		await mw(ctx, async () => undefined);
		expect(state.status).toBe(401);
		expect((state.body as { code?: string }).code).toBe("SETUP_TOKEN_INVALID");
	});

	test("accepts matching token on selfhosted", async () => {
		EditionPolicyService.setTestOverrides({ deployment_mode: "selfhosted", edition: "oss" });
		const token = "es_setup_testtoken1234567890ab";
		(config as { ENVSYNC_SETUP_TOKEN?: string }).ENVSYNC_SETUP_TOKEN = token;
		const mw = setupTokenMiddleware();
		const { ctx, state } = mockCtx({ "X-EnvSync-Setup-Token": token });
		let nextCalled = false;
		await mw(ctx, async () => {
			nextCalled = true;
		});
		expect(nextCalled).toBe(true);
		expect(state.status).toBeUndefined();
	});
});
