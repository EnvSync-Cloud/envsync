/**
 * In-memory OpenFGA mock for tests.
 *
 * Stores tuples as strings and implements simplified hierarchy resolution
 * matching the authorization model in src/libs/openfga/model.ts.
 */
import { mock } from "bun:test";

type TupleKey = { user: string; relation: string; object: string };

/** Serialized tuple set */
const tuples = new Set<string>();

function serialize(t: TupleKey): string {
	return `${t.user}#${t.relation}@${t.object}`;
}

function deserialize(s: string): TupleKey {
	const hashIdx = s.indexOf("#");
	const atIdx = s.indexOf("@", hashIdx);
	return {
		user: s.slice(0, hashIdx),
		relation: s.slice(hashIdx + 1, atIdx),
		object: s.slice(atIdx + 1),
	};
}

function hasTuple(user: string, relation: string, object: string): boolean {
	return tuples.has(serialize({ user, relation, object }));
}

/**
 * Simplified permission check that resolves the OpenFGA model hierarchy.
 * Handles direct tuples + computed relations for org, app, env_type types.
 */
function checkPermission(user: string, relation: string, object: string): boolean {
	// Direct check
	if (hasTuple(user, relation, object)) return true;

	const objectType = object.split(":")[0];

	if (objectType === "org") {
		// Computed org relations
		switch (relation) {
			case "can_manage_roles":
			case "can_manage_users":
			case "can_manage_apps":
			case "can_view_audit_logs":
			case "can_manage_invites":
				return hasTuple(user, "admin", object) || hasTuple(user, "master", object);

			case "can_manage_api_keys":
				// Intersection: have_api_access AND can_manage_users
				return (
					checkPermission(user, "have_api_access", object) &&
					checkPermission(user, "can_manage_users", object)
				);

			case "can_manage_webhooks":
				// Intersection: have_webhook_access AND can_manage_users
				return (
					checkPermission(user, "have_webhook_access", object) &&
					checkPermission(user, "can_manage_users", object)
				);

			case "can_manage_org_settings":
				return hasTuple(user, "master", object);

			// Capability relations inherit from admin/master
			case "can_view":
			case "can_edit":
			case "have_api_access":
			case "have_billing_options":
			case "have_webhook_access":
				return hasTuple(user, "admin", object) || hasTuple(user, "master", object);
		}
	}

	if (objectType === "app") {
		// App relations with org inheritance via tupleToUserset
		const orgTuple = findTuples({ relation: "org", object }).find(Boolean);
		const orgId = orgTuple?.user; // e.g. "org:xxx"

		switch (relation) {
			case "can_view":
				return (
					hasTuple(user, "viewer", object) ||
					hasTuple(user, "editor", object) ||
					hasTuple(user, "admin", object) ||
					(orgId ? checkPermission(user, "can_view", orgId) : false)
				);
			case "can_edit":
				return (
					hasTuple(user, "editor", object) ||
					hasTuple(user, "admin", object) ||
					(orgId ? checkPermission(user, "can_edit", orgId) : false)
				);
			case "can_manage":
				return (
					hasTuple(user, "admin", object) ||
					(orgId ? checkPermission(user, "can_manage_apps", orgId) : false)
				);
		}
	}

	if (objectType === "env_type") {
		// EnvType relations with app + org inheritance
		const appTuple = findTuples({ relation: "app", object }).find(Boolean);
		const orgTuple = findTuples({ relation: "org", object }).find(Boolean);
		const appId = appTuple?.user;
		const orgId = orgTuple?.user;

		switch (relation) {
			case "can_view":
				return (
					hasTuple(user, "viewer", object) ||
					hasTuple(user, "editor", object) ||
					hasTuple(user, "admin", object) ||
					(appId ? checkPermission(user, "can_view", appId) : false)
				);
			case "can_edit":
				return (
					hasTuple(user, "editor", object) ||
					hasTuple(user, "admin", object) ||
					(appId ? checkPermission(user, "can_edit", appId) : false)
				);
			case "can_manage_protected":
				return (
					hasTuple(user, "admin", object) ||
					(orgId ? hasTuple(user, "master", orgId) : false) ||
					(orgId ? hasTuple(user, "admin", orgId) : false)
				);
		}
	}

	// Team member expansion: check if user is a member of a team that has the relation
	// e.g. "team:xxx#member" has "admin" on "org:yyy" → user:u is member of team:xxx → user has admin
	for (const t of tuples) {
		const parsed = deserialize(t);
		if (parsed.user === user && parsed.relation === "member" && parsed.object.startsWith("team:")) {
			const teamMemberRef = `${parsed.object}#member`;
			if (hasTuple(teamMemberRef, relation, object)) return true;
		}
	}

	return false;
}

function findTuples(partial: Partial<TupleKey>): TupleKey[] {
	const results: TupleKey[] = [];
	for (const s of tuples) {
		const t = deserialize(s);
		if (partial.user && t.user !== partial.user) continue;
		if (partial.relation && t.relation !== partial.relation) continue;
		if (partial.object && t.object !== partial.object) continue;
		results.push(t);
	}
	return results;
}

export const MockFGAClient = {
	storeId: "test-store-id",
	modelId: "test-model-id",

	get store() {
		return this.storeId;
	},
	get model() {
		return this.modelId;
	},

	async check(user: string, relation: string, object: string): Promise<boolean> {
		return checkPermission(user, relation, object);
	},

	async batchCheck(checks: { user: string; relation: string; object: string }[]): Promise<Map<string, boolean>> {
		const results = new Map<string, boolean>();
		for (const c of checks) {
			const key = `${c.relation}:${c.object}`;
			results.set(key, checkPermission(c.user, c.relation, c.object));
		}
		return results;
	},

	async writeTuples(newTuples: TupleKey[]): Promise<void> {
		for (const t of newTuples) {
			tuples.add(serialize(t));
		}
	},

	async deleteTuples(delTuples: TupleKey[]): Promise<void> {
		for (const t of delTuples) {
			tuples.delete(serialize(t));
		}
	},

	async writeTx(req: { writes?: TupleKey[]; deletes?: TupleKey[] }): Promise<void> {
		if (req.writes) {
			for (const t of req.writes) tuples.add(serialize(t));
		}
		if (req.deletes) {
			for (const t of req.deletes) tuples.delete(serialize(t));
		}
	},

	async listObjects(user: string, relation: string, type: string): Promise<string[]> {
		const objects: string[] = [];
		const seen = new Set<string>();
		for (const s of tuples) {
			const t = deserialize(s);
			if (t.object.startsWith(`${type}:`) && !seen.has(t.object)) {
				seen.add(t.object);
				if (checkPermission(user, relation, t.object)) {
					objects.push(t.object);
				}
			}
		}
		return objects;
	},

	async readTuples(tupleKey: Partial<TupleKey>): Promise<TupleKey[]> {
		return findTuples(tupleKey);
	},

	async healthCheck(): Promise<boolean> {
		return true;
	},
};

/** Reset all tuples between tests */
export function resetFGA(): void {
	tuples.clear();
}

/**
 * Convenience: write tuples matching a role's flags for a user in an org.
 * Mirrors roleFlagsToTuples() from AuthorizationService.
 */
export function setupUserOrgTuples(
	userId: string,
	orgId: string,
	role: {
		is_master?: boolean;
		is_admin?: boolean;
		can_view?: boolean;
		can_edit?: boolean;
		have_api_access?: boolean;
		have_billing_options?: boolean;
		have_webhook_access?: boolean;
	},
): void {
	const user = `user:${userId}`;
	const org = `org:${orgId}`;

	tuples.add(serialize({ user, relation: "member", object: org }));
	if (role.is_master) tuples.add(serialize({ user, relation: "master", object: org }));
	if (role.is_admin) tuples.add(serialize({ user, relation: "admin", object: org }));
	if (role.can_view) tuples.add(serialize({ user, relation: "can_view", object: org }));
	if (role.can_edit) tuples.add(serialize({ user, relation: "can_edit", object: org }));
	if (role.have_api_access) tuples.add(serialize({ user, relation: "have_api_access", object: org }));
	if (role.have_billing_options) tuples.add(serialize({ user, relation: "have_billing_options", object: org }));
	if (role.have_webhook_access) tuples.add(serialize({ user, relation: "have_webhook_access", object: org }));
}

/** Register the FGA mock — call this from setup.ts */
export function registerFGAMock(): void {
	mock.module("@/libs/openfga/index", () => ({
		FGAClient: {
			getInstance: async () => MockFGAClient,
		},
	}));
}
