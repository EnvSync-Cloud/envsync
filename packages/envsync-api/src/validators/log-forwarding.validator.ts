import z from "zod";
import "zod-openapi/extend";

const providerType = z.enum(["datadog", "splunk", "sumo-logic"]);

const datadogConfigSchema = z.object({
    api_key: z.string().min(1).openapi({ example: "abc123" }),
    site: z.string().default("datadoghq.com").openapi({ example: "datadoghq.com" }),
    service: z.string().optional().openapi({ example: "envsync" }),
    source: z.string().optional().openapi({ example: "envsync-api" }),
});

const splunkConfigSchema = z.object({
    token: z.string().min(1).openapi({ example: "splunk-hec-token" }),
    endpoint: z.string().url().openapi({ example: "https://splunk.example.com:8088/services/collector" }),
    source: z.string().optional().openapi({ example: "envsync" }),
    index: z.string().optional().openapi({ example: "main" }),
});

const sumoLogicConfigSchema = z.object({
    url: z.string().url().openapi({ example: "https://collectors.sumologic.com/receiver/v1/http/..." }),
});

const providerConfigSchema = z.discriminatedUnion("provider_type", [
    z.object({ provider_type: z.literal("datadog"), config: datadogConfigSchema }),
    z.object({ provider_type: z.literal("splunk"), config: splunkConfigSchema }),
    z.object({ provider_type: z.literal("sumo-logic"), config: sumoLogicConfigSchema }),
]);

export const createLogForwardingRequestSchema = z
    .object({
        name: z.string().min(1).openapi({ example: "Production Datadog" }),
        provider_type: providerType.openapi({ example: "datadog" }),
        config: z.record(z.unknown()).openapi({ example: { api_key: "abc123", site: "datadoghq.com" } }),
        enabled: z.boolean().default(true).openapi({ example: true }),
    })
    .refine(
        (data) => {
            const result = providerConfigSchema.safeParse({
                provider_type: data.provider_type,
                config: data.config,
            });
            return result.success;
        },
        { message: "Invalid config for the specified provider_type" },
    )
    .openapi({ ref: "CreateLogForwardingRequest" });

export const logForwardingResponseSchema = z
    .object({
        id: z.string().openapi({ example: "lf_123" }),
        org_id: z.string().openapi({ example: "org_123" }),
        name: z.string().openapi({ example: "Production Datadog" }),
        provider_type: providerType.openapi({ example: "datadog" }),
        config: z.record(z.unknown()).openapi({ example: { site: "datadoghq.com", service: "envsync" } }),
        enabled: z.boolean().openapi({ example: true }),
        created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
        updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
    })
    .openapi({ ref: "LogForwardingResponse" });

export const logForwardingsResponseSchema = z
    .array(logForwardingResponseSchema)
    .openapi({ ref: "LogForwardingsResponse" });
