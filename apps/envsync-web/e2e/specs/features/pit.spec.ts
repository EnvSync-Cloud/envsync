import { expect, test } from "../../fixtures/test";
import {
	compareFirstTwoPits,
	expectPitHistory,
	gotoPit,
	openTimeRangeMode,
	previewTimeRangeDiff,
	rollbackCurrentPit,
	switchPitKind,
} from "../../helpers/pit";
import {
	createProject,
	createSecret,
	createVariable,
	updateSecret,
	updateVariable,
} from "../../helpers/project-flows";

test.describe("feature: point in time", () => {
	test("supports variables and secrets snapshot compare, time-range compare, and PiT rollback", async ({ page, makeName }) => {
		const project = await createProject(page, makeName("UI_FEATURE_PIT_APP"));
		const variableKey = makeName("UI_FEATURE_PIT_VAR");
		const variableValue = makeName("PIT_VALUE");
		const secretKey = makeName("UI_FEATURE_PIT_SECRET");
		const secretValue = makeName("PIT_SECRET_VALUE");

		await page.goto(`/projects/${project.appId}`, { waitUntil: "domcontentloaded" });
		const envTypeId = await createVariable(page, project.appId, "Development", variableKey, variableValue);
		await updateVariable(page, project.appId, envTypeId, variableKey, `${variableValue}_V2`);
		await updateVariable(page, project.appId, envTypeId, variableKey, `${variableValue}_V3`);
		await page.goto(`/projects/${project.appId}/secrets`, { waitUntil: "domcontentloaded" });
		await createSecret(page, project.appId, "Development", secretKey, secretValue);
		await updateSecret(page, project.appId, envTypeId, secretKey, `${secretValue}_V2`);

		await gotoPit(page, project.appId, "development");
		await expect(page).toHaveURL(/env=development/);
		await expectPitHistory(page);
		await compareFirstTwoPits(page);
		await openTimeRangeMode(page);
		await previewTimeRangeDiff(page);
		await rollbackCurrentPit(page);
		await switchPitKind(page, "secrets");
		await expectPitHistory(page);
		await compareFirstTwoPits(page);
		await openTimeRangeMode(page);
		await previewTimeRangeDiff(page);
		await rollbackCurrentPit(page);

		await page.goto(`/projects/${project.appId}?selected=${encodeURIComponent(envTypeId)}`, {
			waitUntil: "domcontentloaded",
		});
		await expect(page.locator("tr").filter({ hasText: variableKey }).first()).toBeVisible();
	});
});
