import { randomBytes } from "node:crypto";
import { v4 as uuidv4 } from "uuid";

import { DB, JsonValue } from "envsync-api/ports/db";
import { BusinessRuleError, NotFoundError } from "envsync-api/ports/errors";
import {
	CertificateService,
	EditionPolicyService,
	OrgService,
	PlanLimitService,
} from "envsync-api/ports/services";

function randomKid() {
	return randomBytes(16).toString("hex");
}

function allowedIdentifier(orgSlug: string, value: string) {
	const host = value.trim().toLowerCase();
	return host.endsWith(".internal") || host.includes(orgSlug.toLowerCase());
}

export class AcmeService {
	public static directory(orgSlug: string, origin: string) {
		const base = `${origin.replace(/\/$/, "")}/api/acme/${orgSlug}`;
		return {
			newNonce: `${base}/new-nonce`,
			newAccount: `${base}/new-account`,
			newOrder: `${base}/new-order`,
			revokeCert: `${base}/revoke-cert`,
			meta: {
				website: "https://envsync.cloud",
				caaIdentities: ["envsync.internal"],
			},
		};
	}

	public static async createEab(org_id: string, user_id: string) {
		if (!EditionPolicyService.isEnterprise()) {
			throw new BusinessRuleError("Internal ACME requires the Enterprise edition.", 403, "ENTERPRISE_REQUIRED");
		}
		await PlanLimitService.assertFeature(org_id, "certificates");
		const db = await DB.getInstance();
		const now = new Date();
		const id = uuidv4();
		const kid = randomKid();
		const hmac_key = randomBytes(32).toString("base64url");
		await db
			.insertInto("org_acme_eab")
			.values({
				id,
				org_id,
				kid,
				hmac_key,
				created_by: user_id,
				created_at: now,
				updated_at: now,
			})
			.execute();
		return { id, kid, hmac_key };
	}

	public static async listEab(org_id: string) {
		const db = await DB.getInstance();
		return db
			.selectFrom("org_acme_eab")
			.select(["id", "kid", "created_by", "created_at"])
			.where("org_id", "=", org_id)
			.orderBy("created_at", "desc")
			.execute();
	}

	public static async listEabByKid(orgSlug: string, kid: string) {
		const org = await OrgService.getOrgBySlug(orgSlug);
		if (!org) {
			throw new NotFoundError("Organization", orgSlug);
		}
		const db = await DB.getInstance();
		const eab = await db
			.selectFrom("org_acme_eab")
			.selectAll()
			.where("org_id", "=", org.id)
			.where("kid", "=", kid)
			.executeTakeFirst();
		if (!eab) {
			throw new BusinessRuleError("Unknown ACME EAB kid.", 401, "ACME_EAB_INVALID");
		}
		return eab;
	}

	public static async newAccount({
		orgSlug,
		kid,
		hmac_key,
		jwk_thumbprint,
		contacts = [],
	}: {
		orgSlug: string;
		kid: string;
		hmac_key: string;
		jwk_thumbprint: string;
		contacts?: string[];
	}) {
		const org = await OrgService.getOrgBySlug(orgSlug);
		if (!org) {
			throw new NotFoundError("Organization", orgSlug);
		}
		if (!EditionPolicyService.isEnterprise()) {
			throw new BusinessRuleError("Internal ACME requires the Enterprise edition.", 403, "ENTERPRISE_REQUIRED");
		}
		await PlanLimitService.assertFeature(org.id, "certificates");
		const db = await DB.getInstance();
		const eab = await db
			.selectFrom("org_acme_eab")
			.selectAll()
			.where("org_id", "=", org.id)
			.where("kid", "=", kid)
			.executeTakeFirst();
		if (!eab || eab.hmac_key !== hmac_key) {
			throw new BusinessRuleError("Invalid External Account Binding credentials.", 401, "ACME_EAB_INVALID");
		}
		const now = new Date();
		const id = uuidv4();
		await db
			.insertInto("acme_accounts")
			.values({
				id,
				org_id: org.id,
				eab_id: eab.id,
				jwk_thumbprint,
				contacts: new JsonValue(contacts),
				created_at: now,
				updated_at: now,
			})
			.execute();
		return { id, org_id: org.id, status: "valid" };
	}

	public static async newOrder({
		orgSlug,
		account_id,
		identifiers,
	}: {
		orgSlug: string;
		account_id: string;
		identifiers: Array<{ type: string; value: string }>;
	}) {
		const org = await OrgService.getOrgBySlug(orgSlug);
		if (!org) {
			throw new NotFoundError("Organization", orgSlug);
		}
		if (!identifiers.length) {
			throw new BusinessRuleError("Order requires at least one identifier.");
		}
		for (const identifier of identifiers) {
			if (identifier.type !== "dns" || !allowedIdentifier(org.slug, identifier.value)) {
				throw new BusinessRuleError(
					`Identifier ${identifier.value} is not allowed. Use *.internal or a name containing the org slug.`,
				);
			}
		}
		const db = await DB.getInstance();
		const account = await db
			.selectFrom("acme_accounts")
			.selectAll()
			.where("id", "=", account_id)
			.where("org_id", "=", org.id)
			.executeTakeFirst();
		if (!account) {
			throw new NotFoundError("ACME account", account_id);
		}
		const now = new Date();
		const id = uuidv4();
		await db
			.insertInto("acme_orders")
			.values({
				id,
				org_id: org.id,
				account_id,
				status: "ready",
				identifiers: new JsonValue(identifiers),
				csr_pem: null,
				cert_id: null,
				expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
				created_at: now,
				updated_at: now,
			})
			.execute();
		return { id, status: "ready", identifiers, finalize: true };
	}

	public static async finalize({
		orgSlug,
		order_id,
		csr_pem,
	}: {
		orgSlug: string;
		order_id: string;
		csr_pem: string;
	}) {
		const org = await OrgService.getOrgBySlug(orgSlug);
		if (!org) {
			throw new NotFoundError("Organization", orgSlug);
		}
		const db = await DB.getInstance();
		const order = await db
			.selectFrom("acme_orders")
			.selectAll()
			.where("id", "=", order_id)
			.where("org_id", "=", org.id)
			.executeTakeFirst();
		if (!order) {
			throw new NotFoundError("ACME order", order_id);
		}
		const eab = await db
			.selectFrom("acme_accounts")
			.innerJoin("org_acme_eab", "org_acme_eab.id", "acme_accounts.eab_id")
			.select(["org_acme_eab.created_by as created_by"])
			.where("acme_accounts.id", "=", order.account_id)
			.executeTakeFirst();
		if (!eab) {
			throw new NotFoundError("ACME account", order.account_id);
		}
		const cert = await CertificateService.signCsr({
			org_id: org.id,
			issued_by_user_id: eab.created_by,
			csr_pem,
			ttl_days: 90,
			description: "ACME leaf",
		});
		const now = new Date();
		await db
			.updateTable("acme_orders")
			.set({
				status: "valid",
				csr_pem,
				cert_id: cert.id,
				updated_at: now,
			})
			.where("id", "=", order_id)
			.execute();
		return { id: order_id, status: "valid", certificate: cert.cert_pem, cert_id: cert.id };
	}

	public static async getCertificate(orgSlug: string, order_id: string) {
		const org = await OrgService.getOrgBySlug(orgSlug);
		if (!org) {
			throw new NotFoundError("Organization", orgSlug);
		}
		const db = await DB.getInstance();
		const order = await db
			.selectFrom("acme_orders")
			.selectAll()
			.where("id", "=", order_id)
			.where("org_id", "=", org.id)
			.executeTakeFirst();
		if (!order?.cert_id) {
			throw new NotFoundError("ACME certificate", order_id);
		}
		const cert = await CertificateService.getCertificate(order.cert_id);
		const chain = await CertificateService.getChain(org.id);
		return `${cert.cert_pem ?? ""}\n${chain.chain_pem}`;
	}
}
