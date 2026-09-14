import { expect, test } from "../../fixtures/test";
import { waitForTrackedResponse } from "../../helpers/network";

test.describe("feature: webhooks", () => {
	test("creates and deletes a webhook", async ({ page, makeName }) => {
		const webhookName = makeName("UI_WEBHOOK");
		const webhookUrl = "https://example.com/envsync-webhook";

		await page.goto("/org/webhooks", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Webhooks" }).first()).toBeVisible();

		await page.getByRole("button", { name: /Create Webhook/i }).first().click();
		const dialog = page.getByRole("dialog");
		await page.locator("#webhook-name").fill(webhookName);
		await page.locator("#webhook-url").fill(webhookUrl);
		await page.getByText(/Event Subscriptions/i).first().click();
		await page.getByRole("button", { name: /Select all/i }).first().click();
		await dialog.getByText(/Review & Create/i).first().click();

		const createResponse = waitForTrackedResponse(page, {
			method: "POST",
			pathFragment: "/api/webhook",
			expectedStatus: [200, 201],
			failOnUnexpectedStatus: true,
		});
		await dialog.getByRole("button", { name: /^Create Webhook$/i }).click();
		await createResponse;

		const row = page.locator("tr").filter({ hasText: webhookName }).first();
		await expect(row).toBeVisible();

		page.once("dialog", dialog => dialog.accept());
		await row.locator('[title="Delete Webhook"]').click();
		await expect(page.locator("tr").filter({ hasText: webhookName })).toHaveCount(0);
	});
});
