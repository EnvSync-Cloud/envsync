import { expect, test } from "../../fixtures/test";
import { createProject, grantTeamProjectAccess, switchProjectAccessTab, switchTeamsTab } from "../../helpers/project-flows";

test.describe("feature: project access", () => {
	test("grants and revokes team access on a project", async ({ page, makeName }) => {
		const project = await createProject(page, makeName("UI_ACCESS_APP"));
		const teamName = makeName("UI_ACCESS_TEAM");

		await page.goto("/org/access/teams", { waitUntil: "domcontentloaded" });
		await switchTeamsTab(page, "directory");
		await page.getByTestId("teams-create").click();
		const teamDialog = page.getByRole("dialog").last();
		await teamDialog.locator("input").first().fill(teamName);
		await teamDialog.getByRole("button", { name: "Save" }).click();
		await expect(page.locator("tr").filter({ hasText: teamName }).first()).toBeVisible();

		await grantTeamProjectAccess(page, {
			appId: project.appId,
			teamName,
			relation: "editor",
		});

		await switchProjectAccessTab(page, "control");
		const grantRow = page.getByTestId("project-access-panel-control").locator("tr").filter({ hasText: teamName }).first();
		await grantRow.getByRole("button", { name: "Revoke" }).click();
		await expect(page.locator("tr").filter({ hasText: teamName })).toHaveCount(0);
		await switchProjectAccessTab(page, "effective");
		await expect(page.getByTestId("project-access-effective-teams")).not.toContainText(teamName);
	});
});
