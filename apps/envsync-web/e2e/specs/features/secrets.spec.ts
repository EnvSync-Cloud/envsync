import { expect, test } from "../../fixtures/test";
import { createProject, createSecret, deleteSecret, updateSecret } from "../../helpers/project-flows";

test.describe("feature: secrets", () => {
	test("runs secret create, update, and delete with contract assertions", async ({ page, makeName }) => {
		const project = await createProject(page, makeName("UI_FEATURE_SECRET_APP"));
		const key = makeName("UI_FEATURE_SECRET");
		const value = makeName("SECRET");
		const nextValue = `${value}_UPDATED`;

		await page.goto(`/projects/${project.appId}/secrets`, { waitUntil: "domcontentloaded" });
		const envTypeId = await createSecret(page, project.appId, "Development", key, value);
		await updateSecret(page, project.appId, envTypeId, key, nextValue);
		await deleteSecret(page, project.appId, envTypeId, key);

		await expect(page.locator("tr").filter({ hasText: key })).toHaveCount(0);
	});
});
