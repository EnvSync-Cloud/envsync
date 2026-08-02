import { describe, expect, test } from "bun:test";

import { enterpriseManagementModules } from "envsync-enterprise";

import { createApiApp } from "@/app/factory";
import {
	disambiguateOpenApiOperationIds,
	findDuplicateOperationIds,
	type OpenApiDocument,
} from "@/libs/openapi-disambiguate";
import {
	clearManagementModulesForTests,
	MANAGE_API_PREFIX,
	registerManagementModules,
} from "@/modules/load-modules";

describe("OpenAPI operationId disambiguation", () => {
	test("disambiguateOpenApiOperationIds prefixes colliding manage ops", () => {
		const doc: OpenApiDocument = {
			paths: {
				"/api/onboarding/org": {
					post: { operationId: "createOrgInvite" },
				},
				[`${MANAGE_API_PREFIX}/onboarding/org`]: {
					post: { operationId: "createOrgInvite" },
				},
				[`${MANAGE_API_PREFIX}/license/status`]: {
					get: { operationId: "getManagementLicenseStatus" },
				},
			},
		};
		disambiguateOpenApiOperationIds(doc);
		expect(doc.paths!["/api/onboarding/org"]!.post).toMatchObject({
			operationId: "createOrgInvite",
		});
		expect(doc.paths![`${MANAGE_API_PREFIX}/onboarding/org`]!.post).toMatchObject({
			operationId: "manageCreateOrgInvite",
		});
		expect(doc.paths![`${MANAGE_API_PREFIX}/license/status`]!.get).toMatchObject({
			operationId: "getManagementLicenseStatus",
		});
		expect(findDuplicateOperationIds(doc).size).toBe(0);
	});

	test("unified core+manage /openapi has unique operationIds", async () => {
		clearManagementModulesForTests();
		registerManagementModules(enterpriseManagementModules);
		const app = await createApiApp("core");
		const res = await app.request("http://localhost/openapi");
		expect(res.status).toBe(200);
		const spec = (await res.json()) as OpenApiDocument;
		const dups = findDuplicateOperationIds(spec);
		expect(dups.size).toBe(0);
		const paths = Object.keys(spec.paths ?? {});
		expect(paths.some(p => p.startsWith(`${MANAGE_API_PREFIX}/`))).toBe(true);
		expect(paths.some(p => p.startsWith("/api/") && !p.startsWith(MANAGE_API_PREFIX))).toBe(
			true,
		);
	});
});
