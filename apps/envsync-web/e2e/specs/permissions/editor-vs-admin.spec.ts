import { expect, test } from "../../fixtures/test";

test.describe("permissions: editor vs admin", () => {
	test("editor and admin can access teams while admin can access organization settings", async ({ roleFactory }) => {
		const editorContext = await roleFactory("editor");
		const adminContext = await roleFactory("admin");
		const editorPage = await editorContext.newPage();
		const adminPage = await adminContext.newPage();

		try {
			await editorPage.goto("/org/access/teams", { waitUntil: "domcontentloaded" });
			await expect(editorPage.getByRole("heading", { name: "Teams" }).first()).toBeVisible();

			await adminPage.goto("/org/access/teams", { waitUntil: "domcontentloaded" });
			await expect(adminPage.getByRole("heading", { name: "Teams" }).first()).toBeVisible();
			await expect(adminPage.getByTestId("teams-create")).toBeVisible();

			await adminPage.goto("/organisation", { waitUntil: "domcontentloaded" });
			await expect(adminPage.getByRole("heading", { name: /^(Organization|Organisation) Settings$/i })).toBeVisible();
		} finally {
			await editorContext.close();
			await adminContext.close();
		}
	});
});
