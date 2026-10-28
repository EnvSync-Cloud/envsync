import z from "zod";
import "zod-openapi/extend";

const scopeString = (example: string) => z.string().trim().min(1).optional().openapi({ example });

export const projectEnvScopeFields = {
	app_id: scopeString("app_123"),
	app_name: scopeString("Core Platform"),
	env_type_id: scopeString("env_type_123"),
	env_type_name: scopeString("Development"),
};
