import type { Hono } from "hono";
import type { ZodRawShape } from "zod";

/** Which HTTP product process is assembling modules. */
export type ApiSurface = "core" | "management";

export type EnvSchemaExtension = ZodRawShape | (() => ZodRawShape);

/**
 * Modular API capability unit mounted by core or management processes.
 */
export interface ApiModule {
	name: string;
	mountPath: string;
	createRouter: () => Promise<Hono> | Hono;
	extendEnvSchema?: () => ZodRawShape;
	migrationDirectories?: () => string[];
	registerBackgroundHandlers?: () => Promise<void> | void;
}
