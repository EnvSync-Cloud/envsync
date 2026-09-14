import { expect, test } from "../../fixtures/test";

test.describe("feature: roles", () => {
	test("creates and deletes a custom role", async ({ page, makeName }) => {
		const roleName = makeName("UI_ROLE");

		await page.goto("/org/access/roles", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Roles", exact: true }).first()).toBeVisible();

		await page.getByRole("button", { name: /Create Role|Create New Role/i }).first().click();
		const dialog = page.getByRole("dialog");
		await dialog.locator("#role-name").fill(roleName);
		await dialog.getByRole("button", { name: /^Create$/i }).click();
		await expect(page.locator("tr").filter({ hasText: roleName }).first()).toBeVisible();

		const row = page.locator("tr").filter({ hasText: roleName }).first();
		await row.getByRole("button").nth(1).click();
		const deleteDialog = page.getByRole("dialog");
		await expect(deleteDialog.getByText("Delete Role")).toBeVisible();
		await deleteDialog.getByRole("button", { name: "Delete" }).click();
		await expect(page.locator("tr").filter({ hasText: roleName })).toHaveCount(0);
	});
});
