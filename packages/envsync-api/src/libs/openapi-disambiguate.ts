/**
 * Ensure OpenAPI operationIds are unique for SDK codegen.
 *
 * Dual-mounted routes (core `/api/...` + manage `/api/v1/manage/...`) share the same
 * describeRoute() operationIds. Codegen (openapi-typescript-codegen / Fern) fails or
 * drops methods when ids collide.
 */

import { MANAGE_API_PREFIX } from "@/modules/load-modules";

type OpenApiOperation = {
	operationId?: string;
	[key: string]: unknown;
};

type OpenApiPathItem = Record<string, OpenApiOperation | unknown>;

export type OpenApiDocument = {
	paths?: Record<string, OpenApiPathItem>;
	[key: string]: unknown;
};

const HTTP_METHODS = new Set([
	"get",
	"put",
	"post",
	"delete",
	"options",
	"head",
	"patch",
	"trace",
]);

function capitalize(id: string): string {
	if (!id) return id;
	return id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * Prefix manage-surface operationIds that collide with non-manage paths.
 * Mutates and returns the document for chaining.
 */
export function disambiguateOpenApiOperationIds<T extends OpenApiDocument>(doc: T): T {
	const paths = doc.paths;
	if (!paths) return doc;

	const coreIds = new Set<string>();
	const manageOps: Array<{ path: string; method: string; op: OpenApiOperation }> = [];

	for (const [path, item] of Object.entries(paths)) {
		if (!item || typeof item !== "object") continue;
		const isManage = path === MANAGE_API_PREFIX || path.startsWith(`${MANAGE_API_PREFIX}/`);
		for (const [method, raw] of Object.entries(item as OpenApiPathItem)) {
			if (!HTTP_METHODS.has(method.toLowerCase())) continue;
			if (!raw || typeof raw !== "object") continue;
			const op = raw as OpenApiOperation;
			const id = op.operationId;
			if (!id) continue;
			if (isManage) {
				manageOps.push({ path, method, op });
			} else {
				coreIds.add(id);
			}
		}
	}

	const used = new Set(coreIds);
	for (const { op } of manageOps) {
		const id = op.operationId!;
		if (!coreIds.has(id) && !used.has(id)) {
			used.add(id);
			continue;
		}
		// Collides with core (or another rewritten manage id) → manage-prefixed unique id.
		let next = `manage${capitalize(id)}`;
		let n = 2;
		while (used.has(next)) {
			next = `manage${capitalize(id)}${n}`;
			n += 1;
		}
		op.operationId = next;
		used.add(next);
	}

	return doc;
}

/** Collect operationIds; returns duplicates map id → paths. */
export function findDuplicateOperationIds(doc: OpenApiDocument): Map<string, string[]> {
	const byId = new Map<string, string[]>();
	const paths = doc.paths ?? {};
	for (const [path, item] of Object.entries(paths)) {
		if (!item || typeof item !== "object") continue;
		for (const [method, raw] of Object.entries(item as OpenApiPathItem)) {
			if (!HTTP_METHODS.has(method.toLowerCase())) continue;
			if (!raw || typeof raw !== "object") continue;
			const id = (raw as OpenApiOperation).operationId;
			if (!id) continue;
			const key = `${method.toUpperCase()} ${path}`;
			const list = byId.get(id) ?? [];
			list.push(key);
			byId.set(id, list);
		}
	}
	for (const [id, list] of [...byId.entries()]) {
		if (list.length < 2) byId.delete(id);
	}
	return byId;
}
