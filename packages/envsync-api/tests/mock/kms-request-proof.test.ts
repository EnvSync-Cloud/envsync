import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import * as grpc from "@grpc/grpc-js";
import { describe, expect, test } from "bun:test";

import {
	FORWARDED_ACCESS_TOKEN_METADATA_KEY,
	FORWARDED_DPOP_METADATA_KEY,
	FORWARDED_REQUEST_ID_METADATA_KEY,
	assertForwardableMetadata,
	buildMinikmsCallMetadata,
	captureInboundKmsProof,
	currentInboundKmsProof,
	dispatchMinikmsUnary,
	runWithInboundKmsProof,
	stripAuthScheme,
} from "@/libs/kms/request-proof";

const ORIGINAL_PROOF =
	"eyJ0eXAiOiJkcG9wK2p3dCIsImFsZyI6IkVTMjU2IiwiandrIjp7Imt0eSI6IkVDIn19.eyJodG0iOiJQT1NUIiwiaHR1IjoiaHR0cHM6Ly9hcGkuZXhhbXBsZS9hcGkvdjEvc2VjcmV0cyIsImlhdCI6MTcwMDAwMDAwMCwiYXRoIjoiYWJjZC1fdj89In0.sig+/=._-~mode";
const ORIGINAL_TOKEN = "atk.payload.sig+/=mode";
const AUTHORIZATION = `DPoP ${ORIGINAL_TOKEN}`;

const USER_REQUEST_METHODS = [
	"BatchDecrypt",
	"BatchEncrypt",
	"Check",
	"CheckOCSP",
	"ClearTenantWrappingKey",
	"CreateDataKey",
	"CreateEnvCA",
	"CreateOrgCA",
	"CreateOrgCACSR",
	"CreateSession",
	"Decrypt",
	"Delete",
	"Destroy",
	"Encrypt",
	"GetCRL",
	"GetKeyInfo",
	"GetRootCA",
	"History",
	"InstallOrgCA",
	"IssueLeafCert",
	"IssueMemberCert",
	"IssueSessionChallenge",
	"List",
	"ReEncrypt",
	"Read",
	"RevokeCert",
	"RevokeMemberSessions",
	"RevokeSession",
	"RewrapTenantDataKeys",
	"RotateDataKey",
	"SetTenantWrappingKey",
	"SignCSR",
	"ValidateSession",
	"Write",
] as const;

const apiRoot = path.resolve(import.meta.dir, "../..");
const repoRoot = path.resolve(apiRoot, "../..");

function metadataValue(metadata: grpc.Metadata, key: string): string | undefined {
	const values = metadata.get(key);
	if (values.length === 0) return undefined;
	const value = values[0];
	return typeof value === "string" ? value : Buffer.from(value).toString("utf8");
}

function recordingStub() {
	const calls: Array<{ method: string; metadata: grpc.Metadata }> = [];
	const stub = new Proxy(
		{},
		{
			get(_target, prop) {
				if (typeof prop !== "string") return undefined;
				return (
					_request: unknown,
					metadata: grpc.Metadata,
					_options: { deadline: Date },
					callback: (err: null, response: unknown) => void,
				) => {
					calls.push({ method: prop, metadata });
					callback(null, {});
					return { on() { return undefined; } };
				};
			},
		},
	);
	return { stub: stub as unknown as grpc.Client, calls };
}

function rpcMethodNames(source: string): string[] {
	const re = /this\.(?:rpcCallWithAuth|rpcCall|callForOrg)(?:<[\s\S]*?>)?\(\s*this\.\w+,\s*"([A-Za-z0-9]+)"/g;
	return [...source.matchAll(re)].map(match => match[1]);
}

function walkTs(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (entry === "node_modules" || entry === "dist") continue;
		const full = path.join(dir, entry);
		const info = statSync(full);
		if (info.isDirectory()) walkTs(full, out);
		else if (entry.endsWith(".ts")) out.push(full);
	}
	return out;
}

describe("fixture: forwarded-bytes-equal-inbound-header", () => {
	test("every miniKMS RPC copies the inbound header and access token unchanged", async () => {
		const clientSrc = readFileSync(path.join(apiRoot, "src/libs/kms/client.ts"), "utf8");
		const names = rpcMethodNames(clientSrc);
		expect(names.filter(name => name === "CreateSession")).toEqual(["CreateSession", "CreateSession"]);
		for (const method of USER_REQUEST_METHODS) {
			expect(names).toContain(method);
		}
		expect(new Set(names)).toEqual(new Set(USER_REQUEST_METHODS));
		expect(clientSrc.match(/await dispatchMinikmsUnary/g)?.length).toBe(2);
		expect(clientSrc).not.toContain("new grpc.Metadata");
		expect(clientSrc).toContain("dispatchMinikmsUnary<TRes>(stub, method, request, timeoutMs, undefined, onMetadata)");
		expect(clientSrc).toContain("dispatchMinikmsUnary<TRes>(stub, method, request, timeoutMs, sessionToken)");

		const captured = captureInboundKmsProof({
			dpopHeader: ORIGINAL_PROOF,
			credential: AUTHORIZATION,
		});
		expect(captured.dpop).toBe(ORIGINAL_PROOF);
		expect(captured.accessToken).toBe(ORIGINAL_TOKEN);
		expect(captured.dpop).not.toBe(captured.accessToken);

		const previousMode = process.env.MINIKMS_DPOP_MODE;
		const previousSkip = process.env.MINIKMS_DPOP_SKIP;
		process.env.MINIKMS_DPOP_MODE = "enforce";
		process.env.MINIKMS_DPOP_SKIP = "1";
		try {
			await runWithInboundKmsProof(captured, async () => {
				expect(currentInboundKmsProof()?.dpop).toBe(ORIGINAL_PROOF);
				for (const method of names) {
					for (const sessionToken of [undefined, "vault-session-token"]) {
						const { stub, calls } = recordingStub();
						await dispatchMinikmsUnary(stub, method, { org_id: "org-1" }, 1000, sessionToken);
						expect(calls).toHaveLength(1);
						expect(calls[0].method).toBe(method);
						expect(metadataValue(calls[0].metadata, FORWARDED_DPOP_METADATA_KEY)).toBe(ORIGINAL_PROOF);
						expect(metadataValue(calls[0].metadata, FORWARDED_ACCESS_TOKEN_METADATA_KEY)).toBe(ORIGINAL_TOKEN);
						expect(metadataValue(calls[0].metadata, FORWARDED_REQUEST_ID_METADATA_KEY)).toMatch(
							/^[0-9a-f-]{36}$/i,
						);
						if (sessionToken) {
							expect(metadataValue(calls[0].metadata, "authorization")).toBe(`Bearer ${sessionToken}`);
						} else {
							expect(calls[0].metadata.get("authorization")).toEqual([]);
						}
						const keys = Object.keys(calls[0].metadata.getMap());
						expect(keys.filter(key => /mode|skip/i.test(key))).toEqual([]);
						expect(keys.every(key =>
							key === "authorization"
							|| key === FORWARDED_DPOP_METADATA_KEY
							|| key === FORWARDED_ACCESS_TOKEN_METADATA_KEY
							|| key === FORWARDED_REQUEST_ID_METADATA_KEY,
						)).toBe(true);
					}
				}
			});
		} finally {
			if (previousMode === undefined) delete process.env.MINIKMS_DPOP_MODE;
			else process.env.MINIKMS_DPOP_MODE = previousMode;
			if (previousSkip === undefined) delete process.env.MINIKMS_DPOP_SKIP;
			else process.env.MINIKMS_DPOP_SKIP = previousSkip;
		}

		expect(currentInboundKmsProof()).toBeUndefined();
		for (const method of names) {
			const { stub, calls } = recordingStub();
			await dispatchMinikmsUnary(stub, method, {}, 1000, "job-session");
			expect(calls[0].method).toBe(method);
			expect(calls[0].metadata.get(FORWARDED_DPOP_METADATA_KEY)).toEqual([]);
			expect(calls[0].metadata.get(FORWARDED_ACCESS_TOKEN_METADATA_KEY)).toEqual([]);
			expect(metadataValue(calls[0].metadata, "authorization")).toBe("Bearer job-session");
		}
	});

	test("preserves a second inbound value and does not keep it after the request", async () => {
		const first = captureInboundKmsProof({
			dpopHeader: "proof-one",
			credential: "Bearer token-one",
		});
		const second = captureInboundKmsProof({
			dpopHeader: "proof-two+/=",
			credential: "token-two+/=",
		});
		await runWithInboundKmsProof(first, async () => {
			const outer = buildMinikmsCallMetadata();
			expect(metadataValue(outer, FORWARDED_DPOP_METADATA_KEY)).toBe("proof-one");
			expect(metadataValue(outer, FORWARDED_ACCESS_TOKEN_METADATA_KEY)).toBe("token-one");
			await runWithInboundKmsProof(second, async () => {
				const inner = buildMinikmsCallMetadata("sess");
				expect(metadataValue(inner, FORWARDED_DPOP_METADATA_KEY)).toBe("proof-two+/=");
				expect(metadataValue(inner, FORWARDED_ACCESS_TOKEN_METADATA_KEY)).toBe("token-two+/=");
			});
			const restored = buildMinikmsCallMetadata();
			expect(metadataValue(restored, FORWARDED_DPOP_METADATA_KEY)).toBe("proof-one");
		});
		expect(buildMinikmsCallMetadata().get(FORWARDED_DPOP_METADATA_KEY)).toEqual([]);
	});

	test("strips one scheme prefix and keeps the header when it is present", () => {
		expect(stripAuthScheme("DPoP abc.def+/=")).toBe("abc.def+/=");
		expect(stripAuthScheme("Bearer abc.def+/=")).toBe("abc.def+/=");
		expect(stripAuthScheme("bearer abc")).toBe("abc");
		expect(stripAuthScheme("DPoP  abc")).toBe(" abc");
		expect(stripAuthScheme("already.a.token")).toBe("already.a.token");
		const fromCookie = captureInboundKmsProof({
			dpopHeader: undefined,
			credential: "cookie-token+/",
		});
		expect(fromCookie.dpop).toBeNull();
		expect(fromCookie.accessToken).toBe("cookie-token+/");
		const absent = captureInboundKmsProof({ dpopHeader: undefined, credential: null });
		expect(absent.dpop).toBeNull();
		expect(absent.accessToken).toBeNull();
		expect(absent.requestId).toMatch(/^[0-9a-f-]{36}$/i);
		const emptyHeader = captureInboundKmsProof({ dpopHeader: "", credential: "Bearer tok" });
		expect(emptyHeader.dpop).toBe("");
		expect(metadataKeysFor(emptyHeader)).toContain(FORWARDED_DPOP_METADATA_KEY);
	});
});

function metadataKeysFor(proof: { dpop: string | null; accessToken: string | null; requestId: string }): string[] {
	let keys: string[] = [];
	runWithInboundKmsProof(proof, () => {
		keys = Object.keys(buildMinikmsCallMetadata().getMap());
	});
	return keys;
}

describe("fixture: no-mode-or-skip-metadata", () => {
	test("refuses a mode or skip metadata key and never adds one", () => {
		const proofSrc = readFileSync(path.join(apiRoot, "src/libs/kms/request-proof.ts"), "utf8");
		const literalSets = [...proofSrc.matchAll(/metadata\.set\(\s*"([^"]+)"/g)].map(match => match[1]);
		expect(literalSets).toEqual(["authorization"]);
		expect(proofSrc).toContain("metadata.set(FORWARDED_DPOP_METADATA_KEY, proof.dpop)");
		expect(proofSrc).toContain("metadata.set(FORWARDED_ACCESS_TOKEN_METADATA_KEY, proof.accessToken)");
		expect(proofSrc).toContain("metadata.set(FORWARDED_REQUEST_ID_METADATA_KEY, proof.requestId)");
		expect(proofSrc).not.toContain("MINIKMS_DPOP_");

		const metadata = new grpc.Metadata();
		metadata.set("authorization", "Bearer session");
		metadata.set(FORWARDED_DPOP_METADATA_KEY, ORIGINAL_PROOF);
		expect(() => assertForwardableMetadata(metadata)).not.toThrow();
		for (const key of ["x-envsync-dpop-mode", "x-envsync-skip", "mode", "dpop-mode", "dpop_skip"]) {
			const bad = new grpc.Metadata();
			bad.set(key, "1");
			expect(() => assertForwardableMetadata(bad)).toThrow(/Unexpected miniKMS call metadata key/);
		}

		const middleware = readFileSync(path.join(apiRoot, "src/middlewares/auth.middleware.ts"), "utf8");
		const runAt = middleware.indexOf("runWithInboundKmsProof");
		expect(middleware.indexOf("captureInboundKmsProof")).toBeGreaterThan(0);
		expect(middleware.indexOf('dpopHeader: ctx.req.header("DPoP")')).toBeGreaterThan(0);
		expect(runAt).toBeGreaterThan(0);
		expect(middleware.indexOf("ensureProvisionedForAuthenticatedUser", runAt)).toBeGreaterThan(runAt);
		expect(middleware.indexOf("await next()", runAt)).toBeGreaterThan(runAt);
		expect(middleware).toContain("return await runWithInboundKmsProof");
	});
});

describe("fixture: api-never-signs-dpop-proof", () => {
	test("server source does not build a DPoP proof", () => {
		const roots = [
			path.join(apiRoot, "src"),
			path.join(apiRoot, "scripts"),
			path.join(repoRoot, "packages/envsync-enterprise/src"),
		];
		const offenders: string[] = [];
		for (const root of roots) {
			for (const file of walkTs(root)) {
				const text = readFileSync(file, "utf8");
				const rel = path.relative(repoRoot, file);
				if (rel === "packages/envsync-api/src/helpers/dpop.ts") {
					if (
						!text.includes('header.typ !== "dpop+jwt"')
						|| text.includes("SignJWT")
						|| /typ:\s*["']dpop\+jwt["']/.test(text)
						|| text.includes("seenProofs")
						|| !text.includes("dpop:api:jti:")
					) {
						offenders.push(rel);
					}
					continue;
				}
				if (text.includes("dpop+jwt") || /typ:\s*["']dpop\+jwt["']/.test(text)) {
					offenders.push(rel);
				}
			}
		}
		expect(offenders).toEqual([]);
	});
});
