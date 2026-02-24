import { type Context } from "hono";

import { AppService } from "@/services/app.service";
import { AuditLogService } from "@/services/audit_log.service";
import { generateKeyPair } from "@/helpers/key-store";

export class AppController {
	public static readonly createApp = async (c: Context) => {
		const org_id = c.get("org_id");
		let private_key: string | null = null;

		let { name, description, metadata, enable_secrets = false, public_key } = await c.req.json();

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
	};

	public static readonly getApp = async (c: Context) => {
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
			org_id,
		});

		const secretCount = await AppService.getSecretCountByApp({
			app_id: app.id,
			org_id,
		});

		return c.json({ ...app, env_types, envCount, secretCount });
	};

	public static readonly getApps = async (c: Context) => {
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

		// P4 perf fix (#55): env/secret counts require N Vault round-trips per app
		// (getEnvCountByApp + getSecretCountByApp each call kvList per env_type).
		// For 20 apps x 3 env_types = 120 Vault calls. Counts are now only
		// computed on the single-app detail endpoint (getApp).
		return c.json(apps);
	};

	public static readonly updateApp = async (c: Context) => {
		const org_id = c.get("org_id");

		const id = c.req.param("id");

		const { name, description, metadata } = await c.req.json();

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
	};

	public static readonly deleteApp = async (c: Context) => {
		const org_id = c.get("org_id");

		const id = c.req.param("id");

		const app = await AppService.getApp({ id });

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
	};
}
