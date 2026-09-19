import type { Context } from "hono";

import { BusinessRuleError } from "envsync-api/ports/errors";

import { issueAcmeNonce, verifyAcmeJws, verifyEab, type AcmeJws } from "../services/acme-jws";
import { AcmeService } from "../services/acme.service";

function withNonce(c: Context) {
	c.header("Replay-Nonce", issueAcmeNonce());
	c.header("Cache-Control", "no-store");
}

async function readAcmeJws(c: Context): Promise<AcmeJws> {
	const body = (await c.req.json()) as AcmeJws;
	if (!body?.protected || !body.payload || !body.signature) {
		throw new BusinessRuleError("ACME requests must be flattened JWS (application/jose+json).", 400, "ACME_JWS_REQUIRED");
	}
	return body;
}

export class AcmeController {
	public static readonly directory = async (c: Context) => {
		const orgSlug = c.req.param("orgSlug");
		const origin = new URL(c.req.url).origin;
		withNonce(c);
		return c.json(AcmeService.directory(orgSlug, origin));
	};

	public static readonly newNonce = async (c: Context) => {
		withNonce(c);
		return c.body(null, 204);
	};

	public static readonly createEab = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const eab = await AcmeService.createEab(org_id, user_id);
		return c.json(eab, 201);
	};

	public static readonly listEab = async (c: Context) => {
		const org_id = c.get("org_id");
		const keys = await AcmeService.listEab(org_id);
		return c.json(keys, 200);
	};

	public static readonly newAccount = async (c: Context) => {
		const orgSlug = c.req.param("orgSlug");
		withNonce(c);
		const jws = await readAcmeJws(c);
		let verified: Awaited<ReturnType<typeof verifyAcmeJws>>;
		try {
			verified = await verifyAcmeJws(jws);
		} catch (error) {
			if (error instanceof Error && error.message.includes("nonce")) {
				c.header("Retry-After", "0");
				return c.json({ type: "urn:ietf:params:acme:error:badNonce", detail: error.message }, 400);
			}
			throw error;
		}
		const eab = verified.payload.externalAccountBinding as AcmeJws | undefined;
		if (!eab) {
			throw new BusinessRuleError("External Account Binding is required.", 400, "ACME_EAB_REQUIRED");
		}
		const eabHeader = JSON.parse(Buffer.from(eab.protected.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as { kid?: string };
		const kid = eabHeader.kid ?? "";
		const eabKeys = await AcmeService.listEabByKid(orgSlug, kid);
		verifyEab(eab, eabKeys.hmac_key, kid);
		const contacts = Array.isArray(verified.payload.contact) ? (verified.payload.contact as string[]) : [];
		const account = await AcmeService.newAccount({
			orgSlug,
			kid,
			hmac_key: eabKeys.hmac_key,
			jwk_thumbprint: verified.thumbprint,
			contacts,
		});
		return c.json(account, 201);
	};

	public static readonly newOrder = async (c: Context) => {
		const orgSlug = c.req.param("orgSlug");
		withNonce(c);
		const jws = await readAcmeJws(c);
		const verified = await verifyAcmeJws(jws);
		const order = await AcmeService.newOrder({
			orgSlug,
			account_id: String(verified.payload.account_id ?? verified.header.kid ?? ""),
			identifiers: (verified.payload.identifiers ?? []) as Array<{ type: string; value: string }>,
		});
		return c.json(order, 201);
	};

	public static readonly finalize = async (c: Context) => {
		const orgSlug = c.req.param("orgSlug");
		const order_id = c.req.param("orderId");
		withNonce(c);
		const jws = await readAcmeJws(c);
		const verified = await verifyAcmeJws(jws);
		const csrDer = typeof verified.payload.csr === "string" ? verified.payload.csr : "";
		const csr_pem = csrDer.includes("BEGIN")
			? csrDer
			: `-----BEGIN CERTIFICATE REQUEST-----\n${csrDer}\n-----END CERTIFICATE REQUEST-----`;
		const result = await AcmeService.finalize({
			orgSlug,
			order_id,
			csr_pem,
		});
		return c.json(result, 200);
	};

	public static readonly certificate = async (c: Context) => {
		const orgSlug = c.req.param("orgSlug");
		const order_id = c.req.param("orderId");
		withNonce(c);
		const pem = await AcmeService.getCertificate(orgSlug, order_id);
		return c.text(pem, 200, { "Content-Type": "application/pem-certificate-chain" });
	};
}
