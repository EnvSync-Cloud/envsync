import { expect, test } from "../../fixtures/test";

test.describe("feature: audit", () => {
	test("loads activity log and filters by search", async ({ page, makeName }) => {
		await page.goto("/audit", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Activity" }).first()).toBeVisible();

		const searchInput = page.getByPlaceholder("Search audit logs...");
		const needle = makeName("UI_AUDIT_SEARCH");
		const requestPromise = page.waitForRequest((request) => {
			if (!request.url().includes("/api/audit_log")) return false;
			const url = new URL(request.url());
			return url.searchParams.get("q") === needle;
		});
		await searchInput.fill(needle);
		await expect(searchInput).toHaveValue(needle);
		await requestPromise;

		const filterCombo = page.getByRole("combobox").first();
		await filterCombo.click();
		await page.getByRole("option").first().click();
	});
});
