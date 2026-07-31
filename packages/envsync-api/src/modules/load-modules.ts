import type { ZodRawShape } from "zod";

import type { ApiModule, ApiSurface, EnvSchemaExtension } from "@/modules/types";
import { coreApiModules } from "./core-modules";
import { externalApiModules } from "./external-modules";

/**
 * Management modules are owned by `envsync-enterprise` and registered by the
 * management process entrypoint. Core never imports the enterprise package.
 */
let registeredManagementModules: ApiModule[] | null = null;

function resolveEnvShape(extension: EnvSchemaExtension): ZodRawShape {
	return typeof extension === "function" ? extension() : extension;
}

/**
 * Wire management/enterprise modules from `envsync-enterprise`.
 * Must be called before `createApiApp("management")` / background handlers.
 */
export function registerManagementModules(modules: ApiModule[]) {
	registeredManagementModules = [...modules];
}

/** Test helper — clear registration between suites. */
export function clearManagementModulesForTests() {
	registeredManagementModules = null;
}

export function loadApiModules(surface: ApiSurface = "core"): ApiModule[] {
	if (surface === "management") {
		if (!registeredManagementModules || registeredManagementModules.length === 0) {
			return [];
		}
		return [...registeredManagementModules];
	}

	return [...coreApiModules, ...externalApiModules];
}

export function collectEnvSchemaExtensions(
	modules: ApiModule[] = [...coreApiModules, ...externalApiModules, ...(registeredManagementModules ?? [])],
): ZodRawShape[] {
	return modules
		.flatMap(module => {
			if (!module.extendEnvSchema) {
				return [];
			}

			return [resolveEnvShape(module.extendEnvSchema())];
		});
}

export function collectMigrationDirectories(baseDirectories: string[] = [], modules: ApiModule[] = loadApiModules()): string[] {
	const directories = [
		...baseDirectories,
		...modules.flatMap(module => module.migrationDirectories?.() ?? []),
	];

	return [...new Set(directories.filter(Boolean))];
}

export async function registerApiBackgroundHandlers(surface: ApiSurface = "core", modules: ApiModule[] = loadApiModules(surface)) {
	for (const module of modules) {
		await module.registerBackgroundHandlers?.();
	}
}
