import type { Context } from "hono";

import { AcmeService } from "../services/acme.service";

export class AcmeController {
	public static readonly directory = async (c: Context) => {
		const orgSlug = c.req.param("orgSlug");
		const origin = new URL(c.req.url).origin;
		return c.json(AcmeService.directory(orgSlug, origin));
	};

	public static readonly newNonce = async (c: Context) => {
		c.header("Replay-Nonce", crypto.randomUUID());
		c.header("Cache-Control", "no-store");
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
		const body = await c.req.json();
		const account = await AcmeService.newAccount({
			orgSlug,
			kid: body.kid ?? body.eab_kid,
			hmac_key: body.hmac_key ?? body.eab_hmac,
			jwk_thumbprint: body.jwk_thumbprint ?? "manual",
			contacts: body.contact ?? body.contacts ?? [],
		});
		return c.json(account, 201);
	};

	public static readonly newOrder = async (c: Context) => {
		const orgSlug = c.req.param("orgSlug");
		const body = await c.req.json();
		const order = await AcmeService.newOrder({
			orgSlug,
			account_id: body.account_id,
			identifiers: body.identifiers,
		});
		return c.json(order, 201);
	};

	public static readonly finalize = async (c: Context) => {
		const orgSlug = c.req.param("orgSlug");
		const order_id = c.req.param("orderId");
		const body = await c.req.json();
		const result = await AcmeService.finalize({
			orgSlug,
			order_id,
			csr_pem: body.csr_pem,
		});
		return c.json(result, 200);
	};

	public static readonly certificate = async (c: Context) => {
		const orgSlug = c.req.param("orgSlug");
		const order_id = c.req.param("orderId");
		const pem = await AcmeService.getCertificate(orgSlug, order_id);
		return c.text(pem, 200, { "Content-Type": "application/pem-certificate-chain" });
	};
}
