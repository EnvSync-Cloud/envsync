import { expect, test } from "../../fixtures/test";
import { getAppByName, getAppDetail } from "../../helpers/app-data";
import { waitForTrackedResponse } from "../../helpers/network";

test.describe("feature: service tokens", () => {
	test("creates, rotates, and revokes a project service token", async ({ page, makeName }) => {
		const seededApp = await getAppByName(page, "Core Platform");
		expect(seededApp).toBeTruthy();
		const appId = seededApp!.id;
		const tokenName = makeName("UI_SERVICE_TOKEN");

		await page.goto(`/projects/${appId}`, { waitUntil: "domcontentloaded" });
		await page.getByTestId("shell-nav-project-settings").click();
		await expect(page).toHaveURL(new RegExp(`/projects/${appId}/settings/service-tokens`));
		await expect(page.getByRole("heading", { name: "Service Tokens" }).first()).toBeVisible();

		await page.getByTestId("create-service-token").click();
		await expect(page.getByTestId("create-service-token-dialog")).toBeVisible();
		await page.getByTestId("service-token-name").fill(tokenName);
		await expect(page.getByTestId("service-token-scope-path-0")).toHaveValue("/");
		await expect(page.getByTestId("service-token-access-read")).toBeChecked();
		await page.getByTestId("add-scope").click();
		await expect(page.getByTestId("service-token-scope-1")).toBeVisible();
		await page.getByTestId("service-token-scope-path-1").fill("/ci");

		const createResponse = waitForTrackedResponse(page, {
			method: "POST",
			pathFragment: "/api/service_token",
			expectedStatus: 201,
			failOnUnexpectedStatus: true,
		});
		await page.getByTestId("create-service-token-submit").click();
		const created = await createResponse;
		expect(created.requestBody).toMatchObject({
			name: tokenName,
			app_id: appId,
			permissions: { read: true, write: false },
			scopes: [
				{ env_type_id: null, path: "/" },
				{ env_type_id: null, path: "/ci" },
			],
		});
		const createdId = (created.responseBody as { id?: string } | null)?.id;
		expect(createdId).toBeTruthy();

		await expect(page.getByRole("heading", { name: "Service Token Created" })).toBeVisible();
		const createdToken = await page.getByTestId("revealed-service-token").inputValue();
		expect(createdToken).toMatch(/^esv_/);
		await page.getByTestId("reveal-service-token-close").click();

		const tokenRow = page.locator("tr").filter({ hasText: tokenName });
		const tokenTable = page.getByRole("table");
		await expect(tokenRow).toHaveCount(1);
		await expect(tokenTable).not.toContainText(createdToken);
		await expect(page.getByTestId("reveal-service-token-dialog")).toBeHidden();

		const rotateResponse = waitForTrackedResponse(page, {
			method: "POST",
			pathFragment: `/api/service_token/${createdId}/rotate`,
			expectedStatus: 201,
			expectedRequestBody: { grace_hours: 24 },
			failOnUnexpectedStatus: true,
		});
		await tokenRow.getByRole("button", { name: "Rotate" }).click();
		await page.getByTestId("confirm-rotate-service-token").click();
		const rotated = await rotateResponse;
		expect(rotated.requestBody).toMatchObject({ grace_hours: 24 });
		expect(rotated.response.url()).toContain(`/api/service_token/${createdId}/rotate`);

		await expect(page.getByRole("heading", { name: "Service Token Rotated" })).toBeVisible();
		const rotatedToken = await page.getByTestId("revealed-service-token").inputValue();
		expect(rotatedToken).toMatch(/^esv_/);
		expect(rotatedToken).not.toBe(createdToken);
		await page.getByTestId("reveal-service-token-close").click();
		await expect(tokenRow).toHaveCount(2);
		await expect(tokenTable).not.toContainText(createdToken);
		await expect(tokenTable).not.toContainText(rotatedToken);

		const firstDelete = waitForTrackedResponse(page, {
			method: "DELETE",
			pathFragment: "/api/service_token/",
			expectedStatus: 200,
			failOnUnexpectedStatus: true,
		});
		await tokenRow.first().getByRole("button", { name: "Revoke" }).click();
		await page.getByTestId("confirm-revoke-service-token").click();
		await firstDelete;
		await expect(tokenRow).toHaveCount(1);

		const secondDelete = waitForTrackedResponse(page, {
			method: "DELETE",
			pathFragment: "/api/service_token/",
			expectedStatus: 200,
			failOnUnexpectedStatus: true,
		});
		await tokenRow.first().getByRole("button", { name: "Revoke" }).click();
		await page.getByTestId("confirm-revoke-service-token").click();
		await secondDelete;
		await expect(tokenRow).toHaveCount(0);
	});

	test("creates a write token scoped to a project environment", async ({ page, makeName }) => {
		const seededApp = await getAppByName(page, "Core Platform");
		expect(seededApp).toBeTruthy();
		const appId = seededApp!.id;
		const app = await getAppDetail(page, appId);
		const environment = app.env_types?.[0];
		expect(environment).toBeTruthy();
		const tokenName = makeName("UI_SERVICE_TOKEN_WRITE");

		await page.goto(`/projects/${appId}/settings/service-tokens`, { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Service Tokens" }).first()).toBeVisible();
		await page.getByTestId("create-service-token").click();
		await page.getByTestId("service-token-name").fill(tokenName);
		await page.getByTestId("service-token-scope-env-0").click();
		await page.getByRole("option", { name: environment!.name }).click();
		await page.getByTestId("service-token-access-write").click();

		const createResponse = waitForTrackedResponse(page, {
			method: "POST",
			pathFragment: "/api/service_token",
			expectedStatus: 201,
			failOnUnexpectedStatus: true,
		});
		await page.getByTestId("create-service-token-submit").click();
		const created = await createResponse;
		expect(created.requestBody).toMatchObject({
			name: tokenName,
			app_id: appId,
			permissions: { read: true, write: true },
			scopes: [{ env_type_id: environment!.id, path: "/" }],
		});

		await expect(page.getByRole("heading", { name: "Service Token Created" })).toBeVisible();
		const createdToken = await page.getByTestId("revealed-service-token").inputValue();
		expect(createdToken).toMatch(/^esv_/);
		await page.getByTestId("reveal-service-token-close").click();

		const tokenRow = page.locator("tr").filter({ hasText: tokenName });
		await expect(tokenRow).toHaveCount(1);
		await expect(tokenRow).not.toContainText(createdToken);
		await expect(tokenRow).toContainText("Read & Write");

		const deleteResponse = waitForTrackedResponse(page, {
			method: "DELETE",
			pathFragment: "/api/service_token/",
			expectedStatus: 200,
			failOnUnexpectedStatus: true,
		});
		await tokenRow.getByRole("button", { name: "Revoke" }).click();
		await page.getByTestId("confirm-revoke-service-token").click();
		await deleteResponse;
		await expect(tokenRow).toHaveCount(0);
	});
});
