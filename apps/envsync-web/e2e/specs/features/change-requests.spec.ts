import { expect, test } from "../../fixtures/test";
import { waitForTrackedResponse } from "../../helpers/network";
import { createProject, setEnvironmentProtected, switchChangeRequestsTab } from "../../helpers/project-flows";

test.describe("feature: change requests", () => {
	test("creates and cancels a direct protected change request", async ({ page, makeName }) => {
		const projectName = makeName("UI_FEATURE_CR_APP");
		const project = await createProject(page, projectName);
		await setEnvironmentProtected(page, project.appId, "Production", true);

		const title = makeName("UI_FEATURE_CR");
		const value = makeName("UI_FEATURE_CR_VALUE");

		await page.goto("/org/change-requests", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Change Requests" })).toBeVisible();
		await switchChangeRequestsTab(page, "create");

		await page.getByTestId("change-request-project-select").click();
		await page.getByRole("option", { name: projectName }).first().click();
		await page.getByTestId("change-request-target-env-select").click();
		await page.getByRole("option", { name: /Production/i }).first().click();

		await page.getByTestId("change-request-title-input").fill(title);
		await page.getByTestId("change-request-message-input").fill("Protected env update through CR.");
		await page.getByTestId("change-request-env-key-input").fill(makeName("UI_FEATURE_CR_KEY"));
		await page.getByTestId("change-request-env-value-input").fill(value);

		const createResponse =
			waitForTrackedResponse(page, {
				method: "POST",
				pathFragment: "/api/change_request/direct",
				expectedStatus: 201,
				failOnUnexpectedStatus: true,
			});
		await page.getByRole("button", { name: "Submit request" }).click();
		await createResponse;

		await switchChangeRequestsTab(page, "list");
		const row = page.locator("tr").filter({ hasText: title }).first();
		await expect(row).toBeVisible();

		const cancelResponse = waitForTrackedResponse(page, {
			method: "POST",
			pathFragment: "/api/change_request/",
			expectedStatus: 200,
			failOnUnexpectedStatus: true,
		});
		await row.getByRole("button", { name: /Cancel/i }).click();
		await cancelResponse;
	});
});
