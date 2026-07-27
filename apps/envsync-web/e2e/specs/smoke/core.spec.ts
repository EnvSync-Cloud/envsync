import { getAppByName } from "../../helpers/app-data";
import {
	createProject,
	createSecret,
	createVariable,
	deleteSecret,
	deleteVariable,
	updateSecret,
	updateVariable,
} from "../../helpers/project-flows";
import { test, expect } from "../../fixtures/test";

test.describe("UI smoke", () => {
	test("covers dashboard, project create, variable CRUD, secret CRUD, certificates and settings", async ({ page, makeName }) => {
		await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
		await expect(page.getByText("Projects").first()).toBeVisible();
		await expect(page.getByText("Security").first()).toBeVisible();

		const projectName = makeName("UI_SMOKE_APP");
		const { appId } = await createProject(page, projectName);

		const variableKey = makeName("UI_SMOKE_VAR");
		const variableValue = makeName("VALUE");
		const variableEnvTypeId = await createVariable(page, appId, "Development", variableKey, variableValue);
		await updateVariable(page, appId, variableEnvTypeId, variableKey, `${variableValue}_UPDATED`);
		await deleteVariable(page, appId, variableEnvTypeId, variableKey);

		await page.goto(`/applications/${appId}/secrets`, { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("link", { name: projectName })).toBeVisible();
		const secretKey = makeName("UI_SMOKE_SECRET");
		const secretValue = makeName("SECRET");
		const secretEnvTypeId = await createSecret(page, appId, "Development", secretKey, secretValue);
		await updateSecret(page, appId, secretEnvTypeId, secretKey, `${secretValue}_UPDATED`);
		await deleteSecret(page, appId, secretEnvTypeId, secretKey);

		await page.goto("/certificates", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Certificates" }).first()).toBeVisible();

		await page.goto("/settings", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Account Settings" }).first()).toBeVisible();
		await expect(page.getByTestId("my-certs-status-row")).toBeVisible();

		await page.goto("/organisation", { waitUntil: "domcontentloaded" });
		await expect(page.getByText("Organization Settings").or(page.getByText("Organisation Settings"))).toBeVisible();
	});

	test("reuses saved session and can reach a seeded project", async ({ page }) => {
		const seededApp = await getAppByName(page, "Core Platform");
		expect(seededApp).toBeTruthy();
		await page.goto(`/applications/${seededApp!.id}`, { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("link", { name: "Core Platform" })).toBeVisible();
	});
});
