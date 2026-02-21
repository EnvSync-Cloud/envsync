import { type Context } from "hono";

import { EnvTypeService } from "@/services/env_type.service";
import { AuditLogService } from "@/services/audit_log.service";

export class EnvTypeController {
	public static readonly getEnvTypes = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const env_types = await EnvTypeService.getEnvTypes(org_id);

			// Log the retrieval of environment types
			await AuditLogService.notifyAuditSystem({
				action: "env_types_viewed",
				org_id,
				user_id: c.get("user_id"),
				message: `retrieved environment types.`,
				details: {
					env_type_count: env_types.length,
				},
			});

			return c.json(env_types);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly createEnvType = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const { name, app_id, color, is_default, is_protected } = await c.req.json();

			if (!name) {
				return c.json({ error: "Name is required." }, 400);
			}

			const env_type = await EnvTypeService.createEnvType({
				org_id,
				name,
				app_id,
				color,
				is_default,
				is_protected,
			});

			// Log the creation of the environment type
			await AuditLogService.notifyAuditSystem({
				action: "env_type_created",
				org_id,
				user_id: c.get("user_id"),
				message: `Environment type ${env_type.name} created.`,
				details: {
					env_type_id: env_type.id,
					name: env_type.name,
				},
			});

			return c.json(env_type, 201);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly updateEnvType = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const { id, name, color, is_default, is_protected } = await c.req.json();

			if (!id || !name) {
				return c.json({ error: "ID and Name are required." }, 400);
			}

			// check existance and ownership
			const envType = await EnvTypeService.getEnvType(id);

			if (!envType) {
				return c.json({ error: "Env type not found." }, 404);
			}
			if (envType.org_id !== org_id) {
				return c.json({ error: "You do not have permission to update this env type." }, 403);
			}

			await EnvTypeService.updateEnvType(id, { name, color, is_default, is_protected });

			// Log the update of the environment type
			await AuditLogService.notifyAuditSystem({
				action: "env_type_updated",
				org_id,
				user_id: c.get("user_id"),
				message: `Environment type ${name} updated.`,
				details: {
					env_type_id: id,
					name,
				},
			});

			return c.json({ message: "Env type updated successfully." });
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly deleteEnvType = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const id = c.req.param("id");

			if (!id) {
				return c.json({ error: "ID is required." }, 400);
			}

			// check existance and ownership
			const envType = await EnvTypeService.getEnvType(id);
			if (!envType) {
				return c.json({ error: "Env type not found." }, 404);
			}
			if (envType.org_id !== org_id) {
				return c.json({ error: "You do not have permission to delete this env type." }, 403);
			}

			await EnvTypeService.deleteEnvType(id);

			// Log the deletion of the environment type
			await AuditLogService.notifyAuditSystem({
				action: "env_type_deleted",
				org_id,
				user_id: c.get("user_id"),
				message: `Environment type ${envType.name} deleted.`,
				details: {
					env_type_id: id,
				},
			});

			return c.json({ message: "Env type deleted successfully." });
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getEnvType = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const { id } = await c.req.json();

			if (!id) {
				return c.json({ error: "ID is required." }, 400);
			}

			// check existance and ownership
			const envType = await EnvTypeService.getEnvType(id);
			if (!envType) {
				return c.json({ error: "Env type not found." }, 404);
			}
			if (envType.org_id !== org_id) {
				return c.json({ error: "You do not have permission to get this env type." }, 403);
			}

			// Log the retrieval of the environment type
			await AuditLogService.notifyAuditSystem({
				action: "env_type_viewed",
				org_id,
				user_id: c.get("user_id"),
				message: `retrieved environment type ${envType.name}.`,
				details: {
					env_type_id: id,
					name: envType.name,
				},
			});

			return c.json(envType);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};
}
