import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import {
	calculateJwkThumbprint,
	decodeJwt,
	exportJWK,
	generateKeyPair,
	SignJWT,
	type JWK,
	type JWTHeaderParameters,
} from "jose";

import * as identity from "@/helpers/identity";
import { DB } from "@/libs/db";
import { config } from "@/utils/env";
import { resetFGA, setupUserOrgTuples } from "../helpers/fga";
import { cleanupDB, seedOrg, type SeedOrgResult } from "../helpers/db";
import { testRequest } from "../helpers/request";

mock.module("@/helpers/jwt", () => ({
	verifyJWTToken: async (token: string) => {
		if (token.startsWith("test-token-")) {
			const sub = token.slice("test-token-".length);
			return { sub, iss: "http://localhost:8080", aud: "test" };
		}
		return decodeJwt(token);
	},
}));

const resourceUrl = "http://localhost/api/auth/me";

async function deviceKey() {
	const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
	const jwk = await exportJWK(publicKey);
	const jkt = await calculateJwkThumbprint(jwk, "sha256");
	return { privateKey, jwk, jkt };
}

async function proof(input: {
	key: CryptoKey;
	jwk: JWK;
	method: string;
	url: string;
	accessToken?: string;
}) {
	const claims: Record<string, unknown> = {
		htm: input.method,
		htu: input.url,
		jti: crypto.randomUUID(),
	};
	if (input.accessToken) {
		const digest = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(input.accessToken),
		);
		claims.ath = Buffer.from(digest).toString("base64url");
	}
	return new SignJWT(claims)
		.setProtectedHeader({
			alg: "ES256",
			typ: "dpop+jwt",
			jwk: input.jwk as JWTHeaderParameters["jwk"],
		})
		.setIssuedAt()
		.sign(input.key);
}

async function accessToken(input: { key: CryptoKey; jkt: string; sub: string; clientId: string }) {
	return new SignJWT({
		client_id: input.clientId,
		cnf: { jkt: input.jkt },
	})
		.setProtectedHeader({ alg: "ES256" })
		.setIssuer(identity.getIdentityIssuer())
		.setSubject(input.sub)
		.setIssuedAt()
		.setExpirationTime("15m")
		.sign(input.key);
}

async function insertDevice(input: {
	directoryUserId: string;
	userId?: string | null;
	jkt: string;
	clientId: string;
	revoked?: boolean;
}) {
	const db = await DB.getInstance();
	await db
		.insertInto("session_devices")
		.values({
			id: randomUUID(),
			directory_user_id: input.directoryUserId,
			user_id: input.userId ?? null,
			client_id: input.clientId,
			jkt: input.jkt,
			label: "Browser",
			created_at: new Date(),
			last_used_at: new Date(),
			revoked_at: input.revoked ? new Date() : null,
		})
		.execute();
}

async function deviceRows(jkt?: string) {
	const db = await DB.getInstance();
	let query = db
		.selectFrom("session_devices")
		.select(["id", "jkt", "revoked_at", "directory_user_id"]);
	if (jkt) query = query.where("jkt", "=", jkt);
	return query.execute();
}

async function seedSessionOrg() {
	const seed = await seedOrg();
	setupUserOrgTuples(seed.masterUser.id, seed.org.id, {
		is_master: true,
		is_admin: true,
		can_view: true,
		can_edit: true,
		have_api_access: true,
		have_billing_options: true,
		have_webhook_access: true,
	});
	return seed;
}

async function sessionMaterial(seed: SeedOrgResult, clientId: string) {
	const device = await deviceKey();
	const token = await accessToken({
		key: device.privateKey,
		jkt: device.jkt,
		sub: seed.masterUser.authServiceId,
		clientId,
	});
	return { ...device, token };
}

async function requestSession(token: string, device: Awaited<ReturnType<typeof deviceKey>>) {
	const signed = await proof({
		key: device.privateKey,
		jwk: device.jwk,
		method: "GET",
		url: resourceUrl,
		accessToken: token,
	});
	const res = await testRequest("/api/auth/me", {
		headers: {
			Authorization: `DPoP ${token}`,
			DPoP: signed,
		},
	});
	const body = (await res.json()) as { code?: string; error?: string };
	return { res, body };
}

const spies: Array<{ mockRestore: () => void }> = [];

function track<T extends { mockRestore: () => void }>(spy: T) {
	spies.push(spy);
	return spy;
}

function expectStatus(status: number, actual: number, body: unknown) {
	if (actual !== status) {
		throw new Error(`expected ${status}, got ${actual}: ${JSON.stringify(body)}`);
	}
}

beforeEach(async () => {
	await cleanupDB();
	resetFGA();
});

afterEach(() => {
	for (const spy of spies) spy.mockRestore();
	spies.length = 0;
});

describe("SessionDeviceService.assertActive", () => {
	test("no-row rejected", async () => {
		const { SessionDeviceService } = await import("@/services/session-device.service");
		try {
			await SessionDeviceService.assertActive("directory-user", "missing-jkt");
			throw new Error("expected DPOP_UNKNOWN_DEVICE");
		} catch (error) {
			expect(error).toMatchObject({ code: "DPOP_UNKNOWN_DEVICE", statusCode: 401 });
		}
	});

	test("active-row allowed", async () => {
		const { SessionDeviceService } = await import("@/services/session-device.service");
		const jkt = "active-jkt";
		await insertDevice({
			directoryUserId: "directory-user",
			jkt,
			clientId: config.ATRIUM_WEB_CLIENT_ID,
		});
		await SessionDeviceService.assertActive("directory-user", jkt);
	});

	test("revoked-row DPOP_REVOKED", async () => {
		const { SessionDeviceService } = await import("@/services/session-device.service");
		const jkt = "revoked-jkt";
		await insertDevice({
			directoryUserId: "directory-user",
			jkt,
			clientId: config.ATRIUM_WEB_CLIENT_ID,
			revoked: true,
		});
		try {
			await SessionDeviceService.assertActive("directory-user", jkt);
			throw new Error("expected DPOP_REVOKED");
		} catch (error) {
			expect(error).toMatchObject({ code: "DPOP_REVOKED", statusCode: 401 });
		}
	});

	test("touch inserts a missing device row", async () => {
		const { SessionDeviceService } = await import("@/services/session-device.service");
		await SessionDeviceService.touch({
			directoryUserId: "directory-user",
			userId: null,
			clientId: config.ATRIUM_WEB_CLIENT_ID,
			jkt: "issued-jkt",
			label: "Browser",
		});
		const rows = await deviceRows("issued-jkt");
		expect(rows).toHaveLength(1);
		expect(rows[0]?.revoked_at).toBeNull();
	});

	test("touch does not insert a missing device row for an ordinary request", async () => {
		const { SessionDeviceService } = await import("@/services/session-device.service");
		await SessionDeviceService.touch(
			{
				directoryUserId: "directory-user",
				userId: null,
				clientId: config.ATRIUM_WEB_CLIENT_ID,
				jkt: "ordinary-jkt",
				label: "Browser",
			},
			{ createIfMissing: false },
		);
		expect(await deviceRows("ordinary-jkt")).toHaveLength(0);
	});
});

describe("session device requests", () => {
	test("no-row rejected", async () => {
		const seed = await seedSessionOrg();
		const session = await sessionMaterial(seed, config.ATRIUM_WEB_CLIENT_ID);
		const { res, body } = await requestSession(session.token, session);
		expectStatus(401, res.status, body);
		expect(body.code).toBe("DPOP_UNKNOWN_DEVICE");
		expect(await deviceRows(session.jkt)).toHaveLength(0);
	});

	test("active-row allowed", async () => {
		const seed = await seedSessionOrg();
		const session = await sessionMaterial(seed, config.ATRIUM_WEB_CLIENT_ID);
		await insertDevice({
			directoryUserId: seed.masterUser.authServiceId,
			userId: seed.masterUser.id,
			jkt: session.jkt,
			clientId: config.ATRIUM_WEB_CLIENT_ID,
		});
		const { res, body } = await requestSession(session.token, session);
		expectStatus(200, res.status, body);
	});

	test("revoked-row DPOP_REVOKED", async () => {
		const seed = await seedSessionOrg();
		const session = await sessionMaterial(seed, config.ATRIUM_WEB_CLIENT_ID);
		await insertDevice({
			directoryUserId: seed.masterUser.authServiceId,
			userId: seed.masterUser.id,
			jkt: session.jkt,
			clientId: config.ATRIUM_WEB_CLIENT_ID,
			revoked: true,
		});
		const { res, body } = await requestSession(session.token, session);
		expectStatus(401, res.status, body);
		expect(body.code).toBe("DPOP_REVOKED");
		const rows = await deviceRows(session.jkt);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.revoked_at).not.toBeNull();
	});

	test("login inserts the row before the next request", async () => {
		const seed = await seedSessionOrg();
		const session = await sessionMaterial(seed, config.ATRIUM_WEB_CLIENT_ID);
		const state = crypto.randomUUID();
		const exchangeProof = await proof({
			key: session.privateKey,
			jwk: session.jwk,
			method: "POST",
			url: identity.publicTokenEndpoint(),
		});
		const exchange = track(spyOn(identity, "exchangeAuthorizationCode")).mockResolvedValue({
			access_token: session.token,
			refresh_token: "refresh-token",
			expires_in: 900,
			refresh_expires_in: 86_400,
			token_type: "DPoP",
		});

		const login = await testRequest("/api/access/web/exchange", {
			method: "POST",
			headers: {
				Cookie: `envsync_login_state=${state}`,
				DPoP: exchangeProof,
			},
			body: { code: "login-code", state, device_label: "Browser" },
		});
		const loginBody = (await login.json()) as { code?: string; access_token?: string };
		expectStatus(200, login.status, loginBody);
		expect(exchange).toHaveBeenCalled();

		const rows = await deviceRows(session.jkt);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.directory_user_id).toBe(seed.masterUser.authServiceId);
		expect(rows[0]?.revoked_at).toBeNull();

		const { res, body } = await requestSession(session.token, session);
		expectStatus(200, res.status, body);
	});

	test("refresh inserts the row before the next request", async () => {
		const seed = await seedSessionOrg();
		const session = await sessionMaterial(seed, config.ATRIUM_WEB_CLIENT_ID);
		const refreshProof = await proof({
			key: session.privateKey,
			jwk: session.jwk,
			method: "POST",
			url: identity.publicTokenEndpoint(),
		});
		track(spyOn(identity, "refreshDirectoryToken")).mockResolvedValue({
			access_token: session.token,
			refresh_token: "refresh-token",
			expires_in: 900,
			refresh_expires_in: 86_400,
			token_type: "DPoP",
		});

		const refresh = await testRequest("/api/access/web/refresh", {
			method: "POST",
			headers: {
				Cookie: "refresh_token=refresh-token",
				DPoP: refreshProof,
			},
			body: { device_label: "Browser" },
		});
		const refreshBody = (await refresh.json()) as { code?: string; access_token?: string };
		expectStatus(200, refresh.status, refreshBody);

		const rows = await deviceRows(session.jkt);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.revoked_at).toBeNull();

		const { res, body } = await requestSession(session.token, session);
		expectStatus(200, res.status, body);
	});

	test("cli session registration inserts the row before the next request", async () => {
		const seed = await seedSessionOrg();
		const session = await sessionMaterial(seed, config.ATRIUM_CLI_CLIENT_ID);
		const registerUrl = "http://localhost/api/access/cli/session";
		const registerProof = await proof({
			key: session.privateKey,
			jwk: session.jwk,
			method: "POST",
			url: registerUrl,
			accessToken: session.token,
		});

		const registered = await testRequest("/api/access/cli/session", {
			method: "POST",
			headers: {
				Authorization: `DPoP ${session.token}`,
				DPoP: registerProof,
			},
		});
		const registeredBody = (await registered.json()) as { code?: string; registered?: boolean };
		expectStatus(200, registered.status, registeredBody);
		expect(registeredBody.registered).toBe(true);

		const rows = await deviceRows(session.jkt);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.directory_user_id).toBe(seed.masterUser.authServiceId);
		expect(rows[0]?.revoked_at).toBeNull();

		const { res, body } = await requestSession(session.token, session);
		expectStatus(200, res.status, body);
	});
});
