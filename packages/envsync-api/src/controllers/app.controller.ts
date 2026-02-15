import { type Context } from "hono";

import { AppService } from "@/services/app.service";
import { AuditLogService } from "@/services/audit_log.service";
import { generateKeyPair } from "@/helpers/key-store";

export class AppController {
	public static readonly createApp = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			let private_key = "";

			let { name, description, metadata, enable_secrets = false, public_key } = await c.req.json();

			const permissions = c.get("permissions");

			// Apps can only be created by admins or masters in the organization
			if (!permissions.is_admin || !permissions.is_master) {
				return c.json({ error: "You do not have permission to create apps." }, 403);
			}

			if (!name) {
				return c.json({ error: "Name is required." }, 400);
			}

			if (enable_secrets && !public_key) {
				const keypair = await generateKeyPair();
				public_key = keypair.publicKey;
				private_key = keypair.privateKey;
			}

			const app = await AppService.createApp({
				name,
				org_id,
				description,
				metadata: metadata || {},
				enable_secrets,
				is_managed_secret: !!private_key,
				public_key,
				private_key,
			});

			// Log the creation of the app
			await AuditLogService.notifyAuditSystem({
				action: "app_created",
				org_id,
				user_id: c.get("user_id"),
				details: {
					app_id: app.id,
					name: app.name,
					enable_secrets: app.enable_secrets,
					public_key: app.public_key,
				},
				message: `App ${app.name} created.`,
			});

			return c.json(app, 201);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getApp = async (c: Context) => {
		try {
			const org_id = c.get("org_id");

			const id = c.req.param("id");

			const app = await AppService.getApp({ id });

			if (app.org_id !== org_id) {
				return c.json({ error: "App does not belong to your organization" }, 403);
			}

			await AuditLogService.notifyAuditSystem({
				action: "app_viewed",
				org_id,
				user_id: c.get("user_id"),
				message: `App ${app.name} viewed.`,
				details: {
					app_id: app.id,
					name: app.name,
				},
			});

			const env_types = await AppService.getAppEnvTypes({
				app_id: app.id,
			});

			const envCount = await AppService.getEnvCountByApp({
				app_id: app.id,
			});

			const secretCount = await AppService.getSecretCountByApp({
				app_id: app.id,
			});

			return c.json({ ...app, env_types, envCount, secretCount });
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getApps = async (c: Context) => {
		try {
			const org_id = c.get("org_id");

			const apps = await AppService.getAllApps(org_id);

			if (!apps || apps.length === 0) {
				return c.json([], 200);
			}

			await AuditLogService.notifyAuditSystem({
				action: "apps_viewed",
				org_id,
				user_id: c.get("user_id"),
				message: `Apps viewed`,
				details: {
					app_count: apps.length,
				},
			});

			// Return the list of apps
			// This could be optimized to include env_types in the response
			const appsWithEnvTypes = await Promise.all(
				apps.map(async app => {
					const env_types = await AppService.getAppEnvTypes({
						app_id: app.id,
					});
					
					// Optionally, you can also get the environment count for each app
					const envCount = await AppService.getEnvCountByApp({
						app_id: app.id,
					});

					// Optionally, you can also get the secret count for each app
					const secretCount = await AppService.getSecretCountByApp({
						app_id: app.id,
					});

					return { ...app, env_types, envCount, secretCount };
				}),
			);

			return c.json(appsWithEnvTypes);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly updateApp = async (c: Context) => {
		try {
			const org_id = c.get("org_id");

			const id = c.req.param("id");

			const { name, description, metadata } = await c.req.json();

			const permissions = c.get("permissions");

			// Apps can only be update by admins or masters
			if (!permissions.is_admin || !permissions.is_master) {
				return c.json({ error: "You do not have permission to update apps." }, 403);
			}

			const app = await AppService.getApp({ id });

			if (app.org_id !== org_id) {
				return c.json({ error: "App does not belong to your organization" }, 403);
			}

			await AppService.updateApp(id, {
				name,
				description,
				metadata,
			});

			// Log the update of the app
			await AuditLogService.notifyAuditSystem({
				action: "app_updated",
				org_id,
				user_id: c.get("user_id"),
				message: `App ${app.name} updated.`,
				details: {
					app_id: app.id,
					name: app.name,
				},
			});

			return c.json({ message: "App updated successfully" });
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly deleteApp = async (c: Context) => {
		try {
			const org_id = c.get("org_id");

			const id = c.req.param("id");

			const app = await AppService.getApp({ id });

			const permissions = c.get("permissions");

			// Apps can only be delete by admins or masters in the organization
			if (!permissions.is_admin || !permissions.is_master) {
				return c.json({ error: "You do not have permission to delete apps." }, 403);
			}

			if (app.org_id !== org_id) {
				return c.json({ error: "App does not belong to your organization" }, 403);
			}

			await AppService.deleteApp({ id });

			// Log the deletion of the app
			await AuditLogService.notifyAuditSystem({
				action: "app_deleted",
				org_id,
				user_id: c.get("user_id"),
				message: `App ${app.name} deleted.`,
				details: {
					app_id: app.id,
					name: app.name,
				},
			});

			return c.json({ message: "App deleted successfully" });
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};
}
