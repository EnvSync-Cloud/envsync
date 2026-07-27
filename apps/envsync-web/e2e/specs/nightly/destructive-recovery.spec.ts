import { expect, test } from "../../fixtures/test";
import { compareFirstTwoPits, expectPitHistory, gotoPit, rollbackCurrentPit } from "../../helpers/pit";
import {
	createProject,
	createSecret,
	createVariable,
	deleteSecret,
	deleteVariable,
	updateVariable,
} from "../../helpers/project-flows";

test.describe("nightly: destructive recovery", () => {
	test("applies mutations then verifies recovery workflows", async ({ page, makeName }) => {
		const project = await createProject(page, makeName("UI_NIGHTLY_APP"));
		const variableKey = makeName("UI_NIGHTLY_VAR");
		const secretKey = makeName("UI_NIGHTLY_SECRET");

		await page.goto(`/applications/${project.appId}`, { waitUntil: "domcontentloaded" });
		const envTypeId = await createVariable(page, project.appId, "Development", variableKey, "VALUE_V1");
		await updateVariable(page, project.appId, envTypeId, variableKey, "VALUE_V2");
		await updateVariable(page, project.appId, envTypeId, variableKey, "VALUE_V3");
		await deleteVariable(page, project.appId, envTypeId, variableKey);

		await page.goto(`/applications/${project.appId}/secrets`, { waitUntil: "domcontentloaded" });
		const secretEnvTypeId = await createSecret(page, project.appId, "Development", secretKey, "SECRET_V1");
		await deleteSecret(page, project.appId, secretEnvTypeId, secretKey);

		await gotoPit(page, project.appId, "development");
		await expectPitHistory(page);
		await compareFirstTwoPits(page);
		await rollbackCurrentPit(page);

		await page.goto(`/applications/${project.appId}`, { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("link", { name: /UI_NIGHTLY_APP/i }).first()).toBeVisible();
	});
});

