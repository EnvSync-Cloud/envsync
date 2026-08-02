import { type Context } from "hono";

import { assertEntitled } from "envsync-api/ports/helpers";
import { AuditLogService } from "envsync-api/ports/services";
import { LogForwardingService } from "../services/log-forwarding.service";

export class LogForwardingController {
    public static readonly createConfig = async (c: Context) => {
        await assertEntitled("log_forwarding");
        const org_id = c.get("org_id");
        const user_id = c.get("user_id");
        const { name, provider_type, config, enabled } = await c.req.json();

        const id = await LogForwardingService.createConfig({
            org_id,
            name,
            provider_type,
            config: config as Record<string, unknown>,
            enabled,
        });

        await AuditLogService.notifyAuditSystem({
            action: "webhook_created",
            org_id,
            user_id,
            details: { log_forwarding_id: id, name, provider_type },
            message: `Log forwarding config ${name} created.`,
        });

        const created = await LogForwardingService.getConfigById(id);
        return c.json(created, 201);
    };

    public static readonly getConfigs = async (c: Context) => {
        await assertEntitled("log_forwarding");
        const org_id = c.get("org_id");
        const configs = await LogForwardingService.getConfigsByOrgId(org_id);
        return c.json(configs, 200);
    };

    public static readonly getConfig = async (c: Context) => {
        await assertEntitled("log_forwarding");
        const org_id = c.get("org_id");
        const id = c.req.param("id");

        const config = await LogForwardingService.getConfigById(id);

        if (config.org_id !== org_id) {
            return c.json({ error: "Log forwarding config does not belong to your organization" }, 403);
        }

        return c.json(config, 200);
    };

    public static readonly deleteConfig = async (c: Context) => {
        await assertEntitled("log_forwarding");
        const org_id = c.get("org_id");
        const user_id = c.get("user_id");
        const id = c.req.param("id");

        const config = await LogForwardingService.getConfigById(id);

        if (config.org_id !== org_id) {
            return c.json({ error: "Log forwarding config does not belong to your organization" }, 403);
        }

        await LogForwardingService.deleteConfig(id);

        await AuditLogService.notifyAuditSystem({
            action: "webhook_deleted",
            org_id,
            user_id,
            details: { log_forwarding_id: id, name: config.name },
            message: `Log forwarding config ${config.name} deleted.`,
        });

        return c.json({ message: "Log forwarding config deleted successfully" }, 200);
    };
}
