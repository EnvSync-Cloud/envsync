import { type Context } from "hono";

import { ApiKeyService } from "@/services/api_key.service";
import { encapsulate } from "@/utils/encapsulate";
import { AuditLogService } from "@/services/audit_log.service";

export class ApiKeyController {
	public static readonly createApiKey = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");

			const { name, description } = await c.req.json();

			if (!name || !org_id) {
				return c.json({ error: "Name and Organization ID are required." }, 400);
			}

			const apiKey = await ApiKeyService.createKey({
				org_id,
				description,
				user_id,
			});

			await AuditLogService.notifyAuditSystem({
				action: "apikey_created",
				org_id,
				user_id: c.get("user_id"),
				message: `API Key created: ${name}`,
				details: {
					api_key_id: apiKey.id,
					name
				},
			});

			return c.json(apiKey, 201);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getApiKey = async (c: Context) => {
		try {
			const id = c.req.param("id");

			if (!id) {
				return c.json({ error: "API Key ID is required." }, 400);
			}

			const apiKey = await ApiKeyService.getKey(id);

			apiKey.key = encapsulate(apiKey.key);

			await AuditLogService.notifyAuditSystem({
				action: "apikey_viewed",
				org_id: c.get("org_id"),
				user_id: c.get("user_id"),
				message: `API Key viewed: ${apiKey.key}`,
				details: {
					api_key_id: apiKey.id,
				},
			});

			return c.json(apiKey, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getAllApiKeys = async (c: Context) => {
		try {
			const org_id = c.get("org_id");

			if (!org_id) {
				return c.json({ error: "Organization ID is required." }, 400);
			}

			const apiKeys = await ApiKeyService.getAllKeys(org_id);

			apiKeys.forEach(key => {
				key.key = encapsulate(key.key);
			});

			await AuditLogService.notifyAuditSystem({
				action: "apikeys_viewed",
				org_id,
				user_id: c.get("user_id"),
				message: "All API Keys viewed",
				details: {
					count: apiKeys.length,
				},
			});

			return c.json(apiKeys, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly updateApiKey = async (c: Context) => {
		try {
			const id = c.req.param("id");
			const { last_used_at, description, is_active } = await c.req.json();

			if (!id) {
				return c.json({ error: "API Key ID is required." }, 400);
			}

			await ApiKeyService.updateKey(id, {
				description,
				is_active,
				last_used_at,
			});

			await AuditLogService.notifyAuditSystem({
				action: "apikey_updated",
				org_id: c.get("org_id"),
				user_id: c.get("user_id"),
				message: `API Key updated: ${id}`,
				details: {
					api_key_id: id,
					description,
					is_active,
					last_used_at,
				},
			});

			return c.json({ message: "API Key updated successfully." }, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly deleteApiKey = async (c: Context) => {
		try {
			const id = c.req.param("id");

			if (!id) {
				return c.json({ error: "API Key ID is required." }, 400);
			}

			await ApiKeyService.deleteKey(id);

			await AuditLogService.notifyAuditSystem({
				action: "apikey_deleted",
				org_id: c.get("org_id"),
				user_id: c.get("user_id"),
				message: `API Key deleted: ${id}`,
				details: {
					api_key_id: id,
				},
			});

			return c.json({ message: "API Key deleted successfully." }, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getKeysByUserId = async (c: Context) => {
		try {
			const userId = c.req.param("user_id");

			if (!userId) {
				return c.json({ error: "User ID is required." }, 401);
			}

			const keys = await ApiKeyService.getKeyByUserId(userId);

			if (!keys || keys.length === 0) {
				return c.json({ error: "No API keys found for this user." }, 404);
			}

			keys.forEach(key => {
				key.key = encapsulate(key.key);
			});

			await AuditLogService.notifyAuditSystem({
				action: "apikeys_viewed",
				org_id: c.get("org_id"),
				user_id: c.get("user_id"),
				message: `API Keys viewed for user: ${userId}`,
				details: {
					count: keys.length,
					user_id: userId,
				},
			});

			return c.json(keys, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly regenerateApiKey = async (c: Context) => {
		try {
			const id = c.req.param("id");

			if (!id) {
				return c.json({ error: "API Key ID is required." }, 400);
			}

			const newKey = await ApiKeyService.regenerateKey(id);

			if (!newKey) {
				return c.json({ error: "Failed to regenerate API Key." }, 500);
			}

			await AuditLogService.notifyAuditSystem({
				action: "apikey_regenerated",
				org_id: c.get("org_id"),
				user_id: c.get("user_id"),
				message: `API Key regenerated: ${id}`,
				details: {
					api_key_id: id,
				},
			});

			return c.json(newKey, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};
}
