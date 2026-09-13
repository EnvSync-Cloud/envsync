import { expect, test } from "../../fixtures/test";
import { waitForTrackedResponse } from "../../helpers/network";

test.describe("feature: api keys", () => {
	test("creates and closes API key dialog flow", async ({ page, makeName }) => {
		await page.goto("/apikeys", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "API Keys" }).first()).toBeVisible();

		await page.getByRole("button", { name: "Create API Key" }).click();
		await page.locator("#api-key-name").fill(makeName("UI_API_KEY"));

		const createResponse = waitForTrackedResponse(page, {
			method: "POST",
			pathFragment: "/api/api_key",
			expectedStatus: 201,
			failOnUnexpectedStatus: true,
		});
		await page.getByRole("button", { name: /Create|Creating/i }).last().click();
		await createResponse;

		await expect(page.getByRole("heading", { name: "API Key Created" }).first()).toBeVisible();
		await page.getByRole("button", { name: "Close" }).first().click();
	});
});
