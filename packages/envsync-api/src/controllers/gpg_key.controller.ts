import { type Context } from "hono";

import { GpgKeyService } from "@/services/gpg_key.service";
import { AuditLogService } from "@/services/audit_log.service";

export class GpgKeyController {
	public static readonly generateKey = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			const body = await c.req.json();

			const gpgKey = await GpgKeyService.generateKey({
				org_id,
				user_id,
				...body,
			});

			await AuditLogService.notifyAuditSystem({
				action: "gpg_key_generated",
				org_id,
				user_id,
				message: `GPG key generated: ${body.name}`,
				details: {
					gpg_key_id: gpgKey.id,
					fingerprint: gpgKey.fingerprint,
					algorithm: body.algorithm,
				},
			});

			return c.json(gpgKey, 201);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly importKey = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			const body = await c.req.json();

			const gpgKey = await GpgKeyService.importKey({
				org_id,
				user_id,
				...body,
			});

			await AuditLogService.notifyAuditSystem({
				action: "gpg_key_imported",
				org_id,
				user_id,
				message: `GPG key imported: ${body.name}`,
				details: {
					gpg_key_id: gpgKey.id,
					fingerprint: gpgKey.fingerprint,
				},
			});

			return c.json(gpgKey, 201);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly listKeys = async (c: Context) => {
		try {
			const org_id = c.get("org_id");

			const keys = await GpgKeyService.listKeys(org_id);

			return c.json(keys, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getKey = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			const id = c.req.param("id");

			const key = await GpgKeyService.getKey(id, org_id);

			await AuditLogService.notifyAuditSystem({
				action: "gpg_key_viewed",
				org_id,
				user_id,
				message: `GPG key viewed: ${key.name}`,
				details: { gpg_key_id: id },
			});

			return c.json(key, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly exportKey = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			const id = c.req.param("id");

			const result = await GpgKeyService.exportPublicKey(id, org_id);

			await AuditLogService.notifyAuditSystem({
				action: "gpg_key_exported",
				org_id,
				user_id,
				message: `GPG public key exported: ${result.fingerprint}`,
				details: { gpg_key_id: id, fingerprint: result.fingerprint },
			});

			return c.json(result, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly deleteKey = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			const id = c.req.param("id");

			await GpgKeyService.deleteKey(id, org_id);

			await AuditLogService.notifyAuditSystem({
				action: "gpg_key_deleted",
				org_id,
				user_id,
				message: `GPG key deleted: ${id}`,
				details: { gpg_key_id: id },
			});

			return c.json({ message: "GPG key deleted successfully." }, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly revokeKey = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			const id = c.req.param("id");
			const { reason } = await c.req.json();

			const key = await GpgKeyService.revokeKey(id, org_id, reason);

			await AuditLogService.notifyAuditSystem({
				action: "gpg_key_revoked",
				org_id,
				user_id,
				message: `GPG key revoked: ${id}`,
				details: { gpg_key_id: id, reason },
			});

			return c.json(key, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly updateTrustLevel = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			const id = c.req.param("id");
			const { trust_level } = await c.req.json();

			const key = await GpgKeyService.updateTrustLevel(id, org_id, trust_level);

			await AuditLogService.notifyAuditSystem({
				action: "gpg_key_trust_updated",
				org_id,
				user_id,
				message: `GPG key trust level updated: ${id}`,
				details: { gpg_key_id: id, trust_level },
			});

			return c.json(key, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly signData = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			const { gpg_key_id, data, mode, detached } = await c.req.json();

			const result = await GpgKeyService.signData(gpg_key_id, org_id, data, mode, detached);

			await AuditLogService.notifyAuditSystem({
				action: "gpg_data_signed",
				org_id,
				user_id,
				message: `Data signed with GPG key: ${gpg_key_id}`,
				details: { gpg_key_id, mode, detached },
			});

			return c.json(result, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly verifySignature = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			const { data, signature, gpg_key_id } = await c.req.json();

			const result = await GpgKeyService.verifySignature(data, signature, gpg_key_id, org_id);

			await AuditLogService.notifyAuditSystem({
				action: "gpg_signature_verified",
				org_id,
				user_id,
				message: `GPG signature verification: ${result.valid ? "valid" : "invalid"}`,
				details: { valid: result.valid, gpg_key_id },
			});

			return c.json(result, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};
}
