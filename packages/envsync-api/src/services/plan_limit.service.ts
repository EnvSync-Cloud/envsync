import { ConflictError, ForbiddenError } from "@/libs/errors";
import { DB } from "@/libs/db";
import { PlanService, type ResolvedPlan } from "@/services/plan.service";
import type { PlanLimits } from "@/services/plan.catalog";

export type PlanCountDimension = "projects" | "members" | "api_keys" | "webhooks" | "orgs";
export type PlanFlag = "change_requests" | "point_in_time" | "byok_secrets" | "certificates";

export class PlanLimitService {
	public static async resolve(orgId: string): Promise<ResolvedPlan> {
		return PlanService.resolve(orgId);
	}

	public static async usage(orgId: string) {
		const db = await DB.getInstance();
		const [projects, members, pendingInvites, apiKeys, webhooks] = await Promise.all([
			db.selectFrom("app").select(({ fn }) => fn.count<string>("id").as("count")).where("org_id", "=", orgId).executeTakeFirstOrThrow(),
			db.selectFrom("users").select(({ fn }) => fn.count<string>("id").as("count")).where("org_id", "=", orgId).executeTakeFirstOrThrow(),
			db
				.selectFrom("invite_user")
				.select(({ fn }) => fn.count<string>("id").as("count"))
				.where("org_id", "=", orgId)
				.where("is_accepted", "=", false)
				.executeTakeFirstOrThrow(),
			db.selectFrom("api_keys").select(({ fn }) => fn.count<string>("id").as("count")).where("org_id", "=", orgId).executeTakeFirstOrThrow(),
			db.selectFrom("webhook_store").select(({ fn }) => fn.count<string>("id").as("count")).where("org_id", "=", orgId).executeTakeFirstOrThrow(),
		]);
		return {
			projects: Number(projects.count),
			members: Number(members.count),
			pending_invites: Number(pendingInvites.count),
			api_keys: Number(apiKeys.count),
			webhooks: Number(webhooks.count),
		};
	}

	public static async assertCount(orgId: string, dimension: PlanCountDimension, extra = 1) {
		const resolved = await PlanService.resolve(orgId);
		const limit = this.limitFor(resolved.limits, dimension);
		if (limit === null) return resolved;
		const used = await this.count(orgId, dimension);
		if (used + extra > limit) {
			throw new ConflictError(
				`This ${dimension.replace("_", " ")} limit is reached on the ${resolved.plan} plan (${used}/${limit}).`,
				"PLAN_LIMIT_REACHED",
			);
		}
		return resolved;
	}

	public static async assertFeature(orgId: string, flag: PlanFlag) {
		const resolved = await PlanService.resolve(orgId);
		if (!resolved.limits[flag]) {
			throw new ForbiddenError(
				`The ${resolved.plan} plan does not include ${flag.replace("_", " ")}.`,
				"PLAN_FEATURE_REQUIRED",
			);
		}
		return resolved;
	}

	public static async assertOrgCreate(currentOrgId: string, authServiceId: string) {
		const resolved = await PlanService.resolve(currentOrgId);
		const limit = resolved.limits.max_orgs;
		if (limit === null) return resolved;
		const db = await DB.getInstance();
		const row = await db
			.selectFrom("users")
			.select(({ fn }) => fn.count<string>("id").as("count"))
			.where("auth_service_id", "=", authServiceId)
			.executeTakeFirstOrThrow();
		const used = Number(row.count);
		if (used + 1 > limit) {
			throw new ConflictError(
				`This organization limit is reached on the ${resolved.plan} plan (${used}/${limit}).`,
				"PLAN_LIMIT_REACHED",
			);
		}
		return resolved;
	}

	private static limitFor(limits: PlanLimits, dimension: PlanCountDimension): number | null {
		if (dimension === "projects") return limits.max_projects;
		if (dimension === "members") return limits.max_members;
		if (dimension === "api_keys") return limits.max_api_keys;
		if (dimension === "webhooks") return limits.max_webhooks;
		return limits.max_orgs;
	}

	private static async count(orgId: string, dimension: PlanCountDimension): Promise<number> {
		const usage = await this.usage(orgId);
		if (dimension === "projects") return usage.projects;
		if (dimension === "members") return usage.members + usage.pending_invites;
		if (dimension === "api_keys") return usage.api_keys;
		if (dimension === "webhooks") return usage.webhooks;
		return 0;
	}
}
