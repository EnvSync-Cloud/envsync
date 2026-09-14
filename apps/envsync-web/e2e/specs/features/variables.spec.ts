import { expect, test } from "../../fixtures/test";
import { createProject, createVariable, deleteVariable, updateVariable } from "../../helpers/project-flows";

test.describe("feature: variables", () => {
	test("runs variable create, update, and delete with contract assertions", async ({ page, makeName }) => {
		const project = await createProject(page, makeName("UI_FEATURE_VAR_APP"));
		const key = makeName("UI_FEATURE_VAR");
		const value = makeName("VALUE");
		const nextValue = `${value}_UPDATED`;

		await page.goto(`/projects/${project.appId}`, { waitUntil: "domcontentloaded" });
		const envTypeId = await createVariable(page, project.appId, "Development", key, value);
		await updateVariable(page, project.appId, envTypeId, key, nextValue);
		await deleteVariable(page, project.appId, envTypeId, key);

		await expect(page.locator("tr").filter({ hasText: key })).toHaveCount(0);
	});
});

