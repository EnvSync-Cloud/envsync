import { DB } from "@/libs/db";
import { BusinessRuleError, NotFoundError } from "@/libs/errors";

export type ProjectEnvScopeInput = {
	app_id?: unknown;
	app_name?: unknown;
	env_type_id?: unknown;
	env_type_name?: unknown;
};

export type ResolvedProjectEnvScope = {
	app_id: string;
	env_type_id: string;
};

function present(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolve a project and environment from ids, names, or both.
 * Names are trimmed and matched case-sensitively inside the caller's organization.
 * An id and a name that point at different rows is a 400.
 * A name that does not exist is a 404.
 * An id-only pair is returned as sent so existing dashboard calls stay unchanged.
 */
export async function resolveProjectEnvScope(
	orgId: string,
	input: ProjectEnvScopeInput,
): Promise<ResolvedProjectEnvScope> {
	const appId = present(input.app_id);
	const appName = present(input.app_name);
	const envTypeId = present(input.env_type_id);
	const envTypeName = present(input.env_type_name);

	if (!appId && !appName) {
		throw new BusinessRuleError("app_id or app_name is required", 400, "SCOPE_REQUIRED");
	}
	if (!envTypeId && !envTypeName) {
		throw new BusinessRuleError("env_type_id or env_type_name is required", 400, "SCOPE_REQUIRED");
	}

	if (appId && !appName && envTypeId && !envTypeName) {
		return { app_id: appId, env_type_id: envTypeId };
	}

	const db = await DB.getInstance();
	let resolvedAppId = appId;

	if (appName) {
		const app = await db
			.selectFrom("app")
			.select("id")
			.where("org_id", "=", orgId)
			.where("name", "=", appName)
			.executeTakeFirst();
		if (!app) {
			throw new NotFoundError("Project", appName);
		}
		if (appId && app.id !== appId) {
			throw new BusinessRuleError(
				"app_id and app_name identify different projects",
				400,
				"SCOPE_MISMATCH",
			);
		}
		resolvedAppId = app.id;
	} else if (appId) {
		const app = await db
			.selectFrom("app")
			.select("id")
			.where("id", "=", appId)
			.where("org_id", "=", orgId)
			.executeTakeFirst();
		if (!app) {
			throw new NotFoundError("Project", appId);
		}
	}

	if (!resolvedAppId) {
		throw new BusinessRuleError("app_id or app_name is required", 400, "SCOPE_REQUIRED");
	}

	if (envTypeName) {
		const envType = await db
			.selectFrom("env_type")
			.select("id")
			.where("org_id", "=", orgId)
			.where("app_id", "=", resolvedAppId)
			.where("name", "=", envTypeName)
			.executeTakeFirst();
		if (!envType) {
			throw new NotFoundError("Environment", envTypeName);
		}
		if (envTypeId && envType.id !== envTypeId) {
			throw new BusinessRuleError(
				"env_type_id and env_type_name identify different environments",
				400,
				"SCOPE_MISMATCH",
			);
		}
		return { app_id: resolvedAppId, env_type_id: envType.id };
	}

	const envType = await db
		.selectFrom("env_type")
		.select(["id", "app_id", "org_id"])
		.where("id", "=", envTypeId!)
		.executeTakeFirst();
	if (!envType || envType.org_id !== orgId || envType.app_id !== resolvedAppId) {
		throw new NotFoundError("Environment", envTypeId);
	}

	return { app_id: resolvedAppId, env_type_id: envType.id };
}
