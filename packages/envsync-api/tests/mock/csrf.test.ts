import { describe, expect, test } from "bun:test";
import { Hono } from "hono";

import { csrfMiddleware } from "@/middlewares/csrf.middleware";

function makeApp() {
	const app = new Hono();
	app.use("*", csrfMiddleware());
	app.post("/api/test", ctx => ctx.json({ ok: true }));
	return app;
}

describe("csrfMiddleware", () => {
	test("allows logout without csrf header for cookie-auth web sessions", async () => {
		const app = makeApp();
		app.post("/api/access/web/logout", ctx => ctx.json({ ok: true }));

		const res = await app.request("http://localhost/api/access/web/logout", {
			method: "POST",
			headers: {
				Cookie: "access_token=session-token",
			},
		});

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});

	test("allows cookie-auth request when csrf header matches csrf cookie", async () => {
		const app = makeApp();

		const res = await app.request("http://localhost/api/test", {
			method: "POST",
			headers: {
				Cookie: "access_token=session-token; envsync_csrf=token-123",
				"X-CSRF-Token": "token-123",
			},
		});

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});

	test("allows cookie-auth request when csrf token is sent only as a header", async () => {
		const app = makeApp();

		const res = await app.request("http://localhost/api/test", {
			method: "POST",
			headers: {
				Cookie: "access_token=session-token",
				"X-CSRF-Token": "token-123",
			},
		});

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});

	test("allows public SAML ACS and start POSTs with leftover cookies", async () => {
		const app = makeApp();
		app.post("/api/saml/acs/org-1", ctx => ctx.json({ ok: true }));
		app.post("/api/saml/sso/acme", ctx => ctx.json({ ok: true }));

		const acs = await app.request("http://localhost/api/saml/acs/org-1", {
			method: "POST",
			headers: { Cookie: "access_token=session-token" },
		});
		expect(acs.status).toBe(200);

		const start = await app.request("http://localhost/api/saml/sso/acme", {
			method: "POST",
			headers: { Cookie: "access_token=session-token" },
		});
		expect(start.status).toBe(200);
	});

	test("rejects cookie-auth request when csrf header and cookie do not match", async () => {
		const app = makeApp();

		const res = await app.request("http://localhost/api/test", {
			method: "POST",
			headers: {
				Cookie: "access_token=session-token; envsync_csrf=token-123",
				"X-CSRF-Token": "token-456",
			},
		});

		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({
			error: "CSRF token is missing or invalid",
			code: "AUTH_CSRF_INVALID",
		});
	});
});
