import { expect, test } from "../../fixtures/test";
import { switchTeamsTab } from "../../helpers/project-flows";

test.describe("feature: teams", () => {
	test("creates, edits, and deletes a team", async ({ page, makeName }) => {
		const teamName = makeName("UI_TEAM");
		const updatedName = makeName("UI_TEAM_EDITED");

		await page.goto("/org/access/teams", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Teams" }).first()).toBeVisible();
		await switchTeamsTab(page, "directory");

		await page.getByTestId("teams-create").click();
		let dialog = page.getByRole("dialog").last();
		await dialog.locator("input").first().fill(teamName);
		await dialog.locator("textarea").first().fill("Created by UI feature test");
		await dialog.getByRole("button", { name: "Save" }).click();

		const row = page.locator("tr").filter({ hasText: teamName }).first();
		await expect(row).toBeVisible();
		await row.click();
		await switchTeamsTab(page, "detail");
		await expect(page.getByTestId("teams-detail-panel")).toContainText(teamName);

		await page.getByRole("button", { name: "Edit" }).click();
		dialog = page.getByRole("dialog").last();
		await dialog.locator("input").first().fill(updatedName);
		await dialog.getByRole("button", { name: "Save" }).click();
		await expect(page.getByTestId("teams-detail-panel")).toContainText(updatedName);

		await page.getByRole("button", { name: "Delete" }).click();
		await switchTeamsTab(page, "directory");
		await expect(page.locator("tr").filter({ hasText: updatedName })).toHaveCount(0);
	});
});
