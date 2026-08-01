import type { Hono } from "hono";
import type { ZodRawShape } from "zod";

/**
 * Logical product surfaces for module bags.
 * - core: multi-tenant product API
 * - manage: enterprise management surface (mounted under /api/v1/manage when unified)
 */
export type ApiSurface = "core" | "management";

/** @deprecated Prefer ApiSurface; "manage" alias for docs/path naming */
export type ModuleGroup = "core" | "manage" | "management";

export type EnvSchemaExtension = ZodRawShape | (() => ZodRawShape);

/**
 * Modular API capability unit.
 * mountPath is relative to the surface base (e.g. "/enterprise" under /api/v1/manage).
 */
export interface ApiModule {
	name: string;
	mountPath: string;
	createRouter: () => Promise<Hono> | Hono;
	extendEnvSchema?: () => ZodRawShape;
	migrationDirectories?: () => string[];
	registerBackgroundHandlers?: () => Promise<void> | void;
}

function normalizeGroup(group: ModuleGroup | ApiSurface): "core" | "management" {
	if (group === "manage" || group === "management") return "management";
	return "core";
}

/**
 * Process-local module registry (no global side effects across packages
 * except the singleton used by the API process).
 */
export class ModuleRegistry {
	#bags = new Map<"core" | "management", ApiModule[]>();

	register(group: ModuleGroup | ApiSurface, modules: ApiModule[]): void {
		const key = normalizeGroup(group);
		this.#bags.set(key, [...modules]);
	}

	append(group: ModuleGroup | ApiSurface, modules: ApiModule[]): void {
		const key = normalizeGroup(group);
		const existing = this.#bags.get(key) ?? [];
		this.#bags.set(key, [...existing, ...modules]);
	}

	get(group: ModuleGroup | ApiSurface): ApiModule[] {
		return [...(this.#bags.get(normalizeGroup(group)) ?? [])];
	}

	has(group: ModuleGroup | ApiSurface): boolean {
		return (this.#bags.get(normalizeGroup(group))?.length ?? 0) > 0;
	}

	clear(group?: ModuleGroup | ApiSurface): void {
		if (group === undefined) {
			this.#bags.clear();
			return;
		}
		this.#bags.delete(normalizeGroup(group));
	}
}

/** Default registry for the API process (tests may clear between suites). */
export const defaultModuleRegistry = new ModuleRegistry();

/**
 * Mount each module at basePath + mountPath (e.g. basePath "" + "/app" or
 * when the parent already routed to /api/v1/manage, mountPath "/enterprise").
 */
export async function mountModules(app: Hono, modules: ApiModule[]): Promise<void> {
	for (const module of modules) {
		app.route(module.mountPath, await module.createRouter());
	}
}
