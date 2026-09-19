import { expect, test } from "../../fixtures/test";

test.describe("feature: settings", () => {
	test("loads account and organization settings", async ({ page }) => {
		await page.goto("/settings", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Account Settings" }).first()).toBeVisible();
		await expect(page.getByTestId("my-certs-status-row")).toBeVisible();
		await expect(page.getByTestId("my-certs-copy-bundle")).toBeVisible();
		await expect(page.getByTestId("my-certs-download-bundle")).toBeVisible();
		await expect(page.getByTestId("my-certs-section-root-ca")).toBeVisible();
		await expect(page.getByTestId("my-certs-section-member-cert")).toBeVisible();
		await expect(page.getByTestId("my-certs-section-private-key")).toBeVisible();

		await page.goto("/org", { waitUntil: "domcontentloaded" });
		await expect(page.getByTestId("org-settings-heading")).toBeVisible();
	});
});
