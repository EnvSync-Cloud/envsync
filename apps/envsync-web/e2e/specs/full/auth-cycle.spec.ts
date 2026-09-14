import { test, expect } from "../../fixtures/test";
import { ensureRoleStorageState, createRoleContext } from "../../helpers/auth";
import { getStorageStatePath } from "../../helpers/config";

test.describe("full auth cycle", () => {
	test("can logout and regenerate a master session", async ({ page, browser }) => {
		await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

		await page.locator("header button").last().click();
		await page.getByRole("menuitem", { name: "Logout" }).click();
		if (await page.getByRole("button", { name: "Logout" }).isVisible().catch(() => false)) {
			await page.getByRole("button", { name: "Logout" }).click();
		}
		await page.waitForLoadState("domcontentloaded");

		process.env.ENVSYNC_UI_REQUIRE_FRESH_LOGIN = "1";
		try {
			await ensureRoleStorageState("master");
		} finally {
			delete process.env.ENVSYNC_UI_REQUIRE_FRESH_LOGIN;
		}

		const context = await createRoleContext(browser, "master");
		const authedPage = await context.newPage();
		await authedPage.goto("/dashboard", { waitUntil: "domcontentloaded" });
		await expect(authedPage.getByRole("heading", { name: "Dashboard" })).toBeVisible();
		await expect.soft(getStorageStatePath("master")).toContain("master.json");
		await context.close();
	});

	test("viewer session can authenticate and load basic routes", async ({ browser }) => {
		const context = await createRoleContext(browser, "viewer");
		const page = await context.newPage();
		await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
		await page.goto("/projects", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
		await context.close();
	});
});
