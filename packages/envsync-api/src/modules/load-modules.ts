import type { ZodRawShape } from "zod";

import {
	defaultModuleRegistry,
	type ApiModule,
	type ApiSurface,
	type EnvSchemaExtension,
} from "envsync-kernel";

import type { ApiModule as LocalApiModule, ApiSurface as LocalApiSurface } from "@/modules/types";
import { coreApiModules } from "./core-modules";
import { externalApiModules } from "./external-modules";

// Ensure core bag is always seeded (idempotent for tests that clear registry).
function ensureCoreRegistered() {
	if (!defaultModuleRegistry.has("core")) {
		defaultModuleRegistry.register("core", [...coreApiModules, ...externalApiModules] as ApiModule[]);
	}
}

function resolveEnvShape(extension: EnvSchemaExtension): ZodRawShape {
	return typeof extension === "function" ? extension() : extension;
}

/**
 * Wire management/enterprise modules (from envsync-enterprise).
 * Prefer tryRegisterEnterpriseManageModules() on unified core boot.
 */
export function registerManagementModules(modules: LocalApiModule[]) {
	defaultModuleRegistry.register("management", modules as ApiModule[]);
}

/** Test helper — clear management bag (and optionally core for full isolation). */
export function clearManagementModulesForTests() {
	defaultModuleRegistry.clear("management");
}

export function loadApiModules(surface: LocalApiSurface = "core"): LocalApiModule[] {
	if (surface === "management") {
		return defaultModuleRegistry.get("management") as LocalApiModule[];
	}
	ensureCoreRegistered();
	return defaultModuleRegistry.get("core") as LocalApiModule[];
}

export function collectEnvSchemaExtensions(
	modules: LocalApiModule[] = [
		...loadApiModules("core"),
		...defaultModuleRegistry.get("management"),
	] as LocalApiModule[],
): ZodRawShape[] {
	return modules.flatMap(module => {
		if (!module.extendEnvSchema) {
			return [];
		}
		return [resolveEnvShape(module.extendEnvSchema() as EnvSchemaExtension)];
	});
}

export function collectMigrationDirectories(
	baseDirectories: string[] = [],
	modules: LocalApiModule[] = [
		...loadApiModules("core"),
		...defaultModuleRegistry.get("management"),
	] as LocalApiModule[],
): string[] {
	const directories = [
		...baseDirectories,
		...modules.flatMap(module => module.migrationDirectories?.() ?? []),
	];
	return [...new Set(directories.filter(Boolean))];
}

export async function registerApiBackgroundHandlers(
	surface: LocalApiSurface = "core",
	modules: LocalApiModule[] = loadApiModules(surface),
) {
	for (const module of modules) {
		await module.registerBackgroundHandlers?.();
	}
}

/**
 * Unified API: load proprietary manage modules when the surface is enabled and
 * the package is present. Never a hard production dependency of OSS graphs.
 */
export async function tryRegisterEnterpriseManageModules(): Promise<boolean> {
	if (defaultModuleRegistry.has("management")) {
		return true;
	}
	try {
		const { EditionPolicyService } = await import("@/services/edition-policy.service");
		if (!EditionPolicyService.isManagementEnabled()) {
			return false;
		}
		const { enterpriseManagementModules } = await import("envsync-enterprise");
		registerManagementModules(enterpriseManagementModules);
		return true;
	} catch {
		// Package missing or edition gate — OSS / incomplete install.
		return false;
	}
}

/** Path prefix for unified manage surface (recommended product path). */
export const MANAGE_API_PREFIX = "/api/v1/manage";
