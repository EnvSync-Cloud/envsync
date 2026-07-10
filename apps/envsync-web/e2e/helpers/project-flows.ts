import { expect, type Locator, type Page } from "@playwright/test";

import { getUiHarnessConfig } from "./config";
import type { JsonValue } from "./network";
import { waitForTrackedResponse } from "./network";

function expectObjectBody(body: JsonValue | null, label: string): asserts body is Record<string, JsonValue> {
	expect(body, `${label} request body should be a JSON object`).toBeTruthy();
	expect(typeof body, `${label} request body should be an object`).toBe("object");
	expect(Array.isArray(body), `${label} request body should not be an array`).toBe(false);
}

async function openRowActions(page: Page, key: string) {
	const row = page.locator("tr").filter({ hasText: key }).first();
	await row.waitFor({ state: "visible" });
	const actionButton = row.getByRole("button").last();
	await actionButton.scrollIntoViewIfNeeded();
	await actionButton.click({ force: true });
	return row;
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getEnvironmentCard(page: Page, envName: string) {
	return page
		.locator('[class*="bg-zinc-900"]')
		.filter({
			has: page.getByRole("heading", {
				name: new RegExp(`^${escapeRegExp(envName)}$`, "i"),
			}),
		})
			.first();
}

function normalizeSection(value: string) {
	return value.trim().toLowerCase();
}

async function selectComboboxOption(
	page: Page,
	trigger: Locator,
	optionName: string | RegExp,
) {
	await trigger.click();
	const listbox = page.getByRole("listbox").last();
	await expect(listbox).toBeVisible();
	const option = listbox.getByRole("option", { name: optionName }).first();
	await expect(option).toBeVisible();
	await option.click();
}

interface AppDetailResponse {
	env_types?: Array<{
		id: string;
		name: string;
		is_protected?: boolean;
	}>;
}

function getVariablesPath(appId: string, envTypeId: string) {
	return `/applications/${appId}?selected=${encodeURIComponent(envTypeId)}`;
}

function getSecretsPath(appId: string, envTypeId: string) {
	return `/applications/${appId}/secrets?selected=${encodeURIComponent(envTypeId)}`;
}

async function getAppDetail(page: Page, appId: string): Promise<AppDetailResponse> {
	const { apiBaseUrl } = getUiHarnessConfig();
	const response = await page.context().request.get(`${apiBaseUrl}/api/app/${appId}`);
	if (!response.ok()) {
		throw new Error(`Failed to fetch app detail for ${appId}: ${response.status()}`);
	}
	return await response.json() as AppDetailResponse;
}

async function waitForEnvironmentTypeId(page: Page, appId: string, envName: string) {
	await expect
		.poll(async () => {
			const appDetail = await getAppDetail(page, appId);
			return appDetail.env_types?.find((entry) => normalizeSection(entry.name) === normalizeSection(envName))?.id ?? null;
		}, {
			message: `Expected ${envName} to be created`,
		})
		.not.toBeNull();

	const appDetail = await getAppDetail(page, appId);
	const envTypeId = appDetail.env_types?.find((entry) => normalizeSection(entry.name) === normalizeSection(envName))?.id ?? null;
	if (!envTypeId) {
		throw new Error(`Environment type ${envName} was not found after creation`);
	}
	return envTypeId;
}

async function ensureEnvironmentTypeExists(page: Page, appId: string, envName: string) {
	const appDetail = await getAppDetail(page, appId);
	const matchingEnvTypes = appDetail.env_types?.filter(
		(entry) => normalizeSection(entry.name) === normalizeSection(envName),
	) ?? [];

	if (matchingEnvTypes.length > 1) {
		throw new Error(`Expected exactly one ${envName} environment type for ${appId}, found ${matchingEnvTypes.length}`);
	}

	if (matchingEnvTypes.length === 1) {
		await page.goto(`/applications/${appId}/manage-environments`, { waitUntil: "domcontentloaded" });
		await expect(
			page.getByRole("heading", { name: "Manage Environment Types" })
				.or(page.getByRole("heading", { name: "Manage Environments" }))
				.or(page.getByRole("heading", { name: "Environments" })),
		).toBeVisible();
		await expect(page.getByTestId(`env-type-card-${matchingEnvTypes[0]!.id}`)).toBeVisible();
		return;
	}

	await page.goto(`/applications/${appId}/manage-environments`, { waitUntil: "domcontentloaded" });
	await expect(
		page.getByRole("heading", { name: "Manage Environment Types" })
			.or(page.getByRole("heading", { name: "Manage Environments" }))
			.or(page.getByRole("heading", { name: "Environments" })),
	).toBeVisible();

	await page.getByRole("button", { name: /Add Environment|Add Environment Type/ }).click();
	const dialog = page.getByRole("dialog").last();
	await expect(dialog.getByRole("heading", { name: /Create Environment|Add Environment|Create Environment Type/ })).toBeVisible();
	await dialog.locator("#create-env-name").fill(envName);
	await dialog.getByRole("button", { name: /Create|Create Environment Type/ }).click();
	const envTypeId = await waitForEnvironmentTypeId(page, appId, envName);
	await expect(page.getByTestId(`env-type-card-${envTypeId}`)).toBeVisible();
}

export async function switchProjectAccessTab(page: Page, section: "control" | "effective") {
	const tab = section === "control"
		? page.getByTestId("project-access-tab-control")
		: page.getByTestId("project-access-tab-effective");
	await tab.click();
	await expect(
		section === "control"
			? page.getByTestId("project-access-panel-control")
			: page.getByTestId("project-access-panel-effective"),
	).toBeVisible();
}

export async function grantTeamProjectAccess(
	page: Page,
	{
		appId,
		teamName,
		relation,
	}: {
		appId: string;
		teamName: string;
		relation: "viewer" | "editor" | "admin";
	},
) {
	await page.goto(`/applications/${appId}/access`, { waitUntil: "domcontentloaded" });
	await switchProjectAccessTab(page, "control");

	const controlPanel = page.getByTestId("project-access-panel-control");
	const combos = controlPanel.getByRole("combobox");
	await selectComboboxOption(page, combos.nth(0), "Team");
	await selectComboboxOption(page, combos.nth(1), teamName);
	await selectComboboxOption(page, combos.nth(2), new RegExp(`^${escapeRegExp(relation)}$`, "i"));

	const grantResponse = waitForTrackedResponse(page, {
		method: "POST",
		pathFragment: `/api/permission/app/${appId}/grant`,
		expectedStatus: 200,
		failOnUnexpectedStatus: true,
	});

	await page.getByRole("button", { name: /Grant access/i }).click();
	await grantResponse;

	await expect(controlPanel.locator("tr").filter({ hasText: teamName }).first()).toBeVisible();

	await switchProjectAccessTab(page, "effective");
	await expect(page.getByTestId("project-access-effective-teams")).toContainText(teamName);
}

export async function switchTeamsTab(page: Page, section: "directory" | "detail") {
	const tab = section === "directory"
		? page.getByTestId("teams-tab-directory")
		: page.getByTestId("teams-tab-detail");
	await tab.click();
	await expect(
		section === "directory"
			? page.getByTestId("teams-directory-list")
			: page.getByTestId("teams-detail-panel"),
	).toBeVisible();
}

export async function switchUsersTab(page: Page, section: "members" | "invitations") {
	const tab = section === "members"
		? page.getByTestId("users-tab-members")
		: page.getByTestId("users-tab-invitations");
	await tab.click();
	await expect(
		section === "members"
			? page.getByTestId("users-members-table")
			: page.getByTestId("users-invitations-panel"),
	).toBeVisible();
}

export async function switchChangeRequestsTab(page: Page, section: "list" | "create") {
	const tab = section === "list"
		? page.getByTestId("change-requests-tab-list")
		: page.getByTestId("change-requests-tab-create");
	await tab.click();
	await expect(
		section === "list"
			? page.getByTestId("change-requests-list")
			: page.getByRole("heading", { name: "Create Request" }),
	).toBeVisible();
}

export async function createProject(page: Page, projectName: string) {
	await page.goto("/applications", { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Create Project" }).click();
	await expect(page.getByRole("heading", { name: "Create New Project" })).toBeVisible();

	await page.locator("#project-name").fill(projectName);
	await page.locator("#project-description").fill("Temporary project created by the Playwright UI harness.");
	await page.getByRole("switch").click();
	await page.getByRole("button", { name: "Add Common Presets" }).click();

	const createResponse = waitForTrackedResponse(page, {
		method: "POST",
		pathFragment: "/api/app",
		expectedStatus: 201,
		failOnUnexpectedStatus: true,
	});

	await page.getByRole("button", { name: /Create Project with 3 Environments?/ }).click();
	const trackedResponse = await createResponse;
	expectObjectBody(trackedResponse.responseBody, "Create project response");
	expect(typeof trackedResponse.responseBody.id).toBe("string");
	const appId = trackedResponse.responseBody.id as string;
	await page.goto(`/applications/${appId}`, { waitUntil: "domcontentloaded" });
	await expect(page).toHaveURL(new RegExp(`/applications/${escapeRegExp(appId)}(?:\\?|$)`));
	await ensureEnvironmentTypeExists(page, appId, "Development");
	await ensureEnvironmentTypeExists(page, appId, "Staging");
	await ensureEnvironmentTypeExists(page, appId, "Production");
	await page.goto(`/applications/${appId}`, { waitUntil: "domcontentloaded" });

	return {
		appId,
	};
}

export async function openProjectCardActions(page: Page, projectName: string) {
	const card = page.locator('[class*="group cursor-pointer"]').filter({ hasText: projectName }).first();
	await card.waitFor({ state: "visible" });
	await card.hover();
	const actionButton = card.getByRole("button").last();
	await actionButton.click({ force: true });
	return card;
}

export async function editProject(page: Page, projectName: string, nextName: string) {
	await page.goto("/applications", { waitUntil: "domcontentloaded" });
	await openProjectCardActions(page, projectName);
	await page.getByRole("menuitem", { name: "Edit Project" }).click();
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByRole("heading", { name: "Edit Project" })).toBeVisible();
	await dialog.locator("#edit-name").fill(nextName);
	await dialog.getByRole("button", { name: "Save Changes" }).click();
	await expect(page.getByText(nextName).first()).toBeVisible();
}

export async function deleteProject(page: Page, projectName: string) {
	await page.goto("/applications", { waitUntil: "domcontentloaded" });
	await openProjectCardActions(page, projectName);
	await page.getByRole("menuitem", { name: "Delete Project" }).click();
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByRole("heading", { name: "Delete Project" })).toBeVisible();
	await dialog.locator("#delete-confirm").fill(projectName);
	await dialog.getByRole("button", { name: "Delete Project" }).click();
	await expect(page.getByText(projectName)).toHaveCount(0);
}

export async function setEnvironmentProtected(page: Page, appId: string, envName: string, isProtected = true) {
	await ensureEnvironmentTypeExists(page, appId, envName);
	await page.goto(`/applications/${appId}/manage-environments`, { waitUntil: "domcontentloaded" });
	const appDetail = await getAppDetail(page, appId);
	const envType = appDetail.env_types?.find((entry) => normalizeSection(entry.name) === normalizeSection(envName));
	expect(envType).toBeTruthy();
	const card = page.getByTestId(`env-type-card-${envType!.id}`);
	await card.waitFor({ state: "visible" });
	await page.getByTestId(`env-type-edit-${envType!.id}`).click();

	const dialog = page.getByRole("dialog").last();
	await expect(dialog.getByRole("heading", { name: /Edit Environment|Edit Environment Type/ })).toBeVisible();
	const checkbox = dialog.getByTestId("env-type-protected-checkbox");
	const checked = await checkbox.isChecked();
	const updateResponse = waitForTrackedResponse(page, {
		method: "PATCH",
		pathFragment: "/api/env_type/",
		expectedStatus: 200,
		failOnUnexpectedStatus: true,
	});
	if (checked !== isProtected) {
		await checkbox.click();
	}
	await dialog.getByRole("button", { name: /Update|Save|Update Environment Type/ }).click();
	const trackedResponse = await updateResponse;
	expectObjectBody(trackedResponse.requestBody, "Update environment type");
	expect(trackedResponse.requestBody.id).toBeTruthy();
	expect(trackedResponse.requestBody.name).toBe(envName);
	expect(trackedResponse.requestBody.is_protected).toBe(isProtected);
	expectObjectBody(trackedResponse.responseBody, "Update environment type response");
	expect(trackedResponse.responseBody.is_protected).toBe(isProtected);
	await expect
		.poll(async () => {
			const appDetail = await getAppDetail(page, appId);
			return appDetail.env_types?.find(envType => envType.name.toLowerCase() === envName.toLowerCase())?.is_protected ?? null;
		}, {
			message: `Expected ${envName} protection state to persist`,
		})
		.toBe(isProtected);
	await page.goto(`/applications/${appId}/manage-environments`, { waitUntil: "domcontentloaded" });
	if (isProtected) {
		await expect(page.getByTestId(`env-type-protected-badge-${envType!.id}`)).toBeVisible();
	} else {
		await expect(page.getByTestId(`env-type-protected-badge-${envType!.id}`)).toHaveCount(0);
	}
}

export async function createEnvironmentType(page: Page, appId: string, envName: string) {
	await page.goto(`/applications/${appId}/manage-environments`, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: /Add Environment|Add Environment Type/ }).click();
	const dialog = page.getByRole("dialog").last();
	await expect(dialog.getByRole("heading", { name: /Create Environment|Add Environment|Create Environment Type/ })).toBeVisible();
	await dialog.locator("#create-env-name").fill(envName);
	await dialog.getByRole("button", { name: /Create|Create Environment Type/ }).click();
	const envTypeId = await waitForEnvironmentTypeId(page, appId, envName);
	await expect(page.getByTestId(`env-type-card-${envTypeId}`)).toBeVisible();
}

export async function deleteEnvironmentType(page: Page, appId: string, envName: string) {
	await page.goto(`/applications/${appId}/manage-environments`, { waitUntil: "domcontentloaded" });
	const appDetail = await getAppDetail(page, appId);
	const envType = appDetail.env_types?.find((entry) => normalizeSection(entry.name) === normalizeSection(envName));
	expect(envType).toBeTruthy();
	await page.getByTestId(`env-type-card-${envType!.id}`).waitFor({ state: "visible" });
	await page.getByTestId(`env-type-delete-${envType!.id}`).click();
	const dialog = page.getByRole("dialog").last();
	await expect(dialog.getByRole("heading", { name: /Delete Environment|Delete Environment Type/ })).toBeVisible();
	await dialog.locator("#delete-confirm-text").fill(envName);
	await dialog.getByRole("button", { name: /Delete|Delete Environment Type/ }).click();
	await expect(page.getByText(envName)).toHaveCount(0);
}

export async function createVariable(page: Page, appId: string, envTypeName: string, key: string, value: string) {
	await page.getByTestId("project-variables-primary-action").click();
	const dialog = page.getByRole("dialog").last();
	await expect(dialog).toBeVisible();

	await dialog.getByRole("combobox").click();
	const listbox = page.getByRole("listbox").last();
	await expect(listbox).toBeVisible();
	await listbox.getByRole("option", { name: envTypeName }).first().click();
	await dialog.locator("#var-key").fill(key);
	await dialog.locator("#var-value").fill(value);

	const createResponse = waitForTrackedResponse(page, {
		method: "PUT",
		pathFragment: "/api/env/single",
		expectedStatus: 201,
		failOnUnexpectedStatus: true,
	});

	await dialog.getByRole("button", { name: "Add Variable" }).click();
	const trackedResponse = await createResponse;
	expectObjectBody(trackedResponse.requestBody, "Create env");
	expect(trackedResponse.requestBody.key).toBe(key);
	expect(trackedResponse.requestBody.value).toBe(value);
	expect(trackedResponse.requestBody.app_id).toBe(appId);
	expect(trackedResponse.requestBody.env_type_id).toBeTruthy();
	const envTypeId = String(trackedResponse.requestBody.env_type_id);
	await page.goto(getVariablesPath(appId, envTypeId), { waitUntil: "domcontentloaded" });
	await expect(page.locator("tr").filter({ hasText: key }).first()).toBeVisible();

	return envTypeId;
}

export async function updateVariable(page: Page, appId: string, envTypeId: string, key: string, nextValue: string) {
	await openRowActions(page, key);
	await page.getByRole("menuitem", { name: "Edit Variable" }).click();
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await expect(dialog.locator("#edit-var-key")).toBeDisabled();

	await dialog.locator("#edit-var-value").fill(nextValue);
	const updateResponse = waitForTrackedResponse(page, {
		method: "PATCH",
		pathFragment: `/api/env/i/${key}`,
		expectedStatus: 200,
		failOnUnexpectedStatus: true,
	});

	await dialog.getByRole("button", { name: "Save Changes" }).click();
	const trackedResponse = await updateResponse;
	expectObjectBody(trackedResponse.requestBody, "Update env");
	expect(trackedResponse.requestBody.app_id).toBe(appId);
	expect(trackedResponse.requestBody.env_type_id).toBe(envTypeId);
	expect(trackedResponse.requestBody.value).toBe(nextValue);
	expect(trackedResponse.requestBody.key).toBeUndefined();
	await page.goto(getVariablesPath(appId, envTypeId), { waitUntil: "domcontentloaded" });
	await expect(page.locator("tr").filter({ hasText: nextValue }).first()).toBeVisible();
}

export async function deleteVariable(page: Page, appId: string, envTypeId: string, key: string) {
	await openRowActions(page, key);
	const deleteMenuItem = page.getByRole("menuitem", { name: /Delete Variable|Delete/i }).first();
	await deleteMenuItem.click();
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await dialog.locator("#delete-confirm").fill(key);

	const deleteResponse = waitForTrackedResponse(page, {
		method: "DELETE",
		pathFragment: "/api/env",
		expectedStatus: 200,
		failOnUnexpectedStatus: true,
	});
	await dialog.getByRole("button", { name: /Delete Variable/ }).click();

	const trackedResponse = await deleteResponse;
	expectObjectBody(trackedResponse.requestBody, "Delete env");
	expect(trackedResponse.requestBody.key).toBe(key);
	expect(trackedResponse.requestBody.app_id).toBe(appId);
	expect(trackedResponse.requestBody.env_type_id).toBe(envTypeId);
	await page.goto(getVariablesPath(appId, envTypeId), { waitUntil: "domcontentloaded" });
	await expect(page.locator("tr").filter({ hasText: key })).toHaveCount(0);
}

export async function createSecret(page: Page, appId: string, envTypeName: string, key: string, value: string) {
	await page.getByTestId("project-secrets-primary-action").click();
	const dialog = page.getByRole("dialog").last();
	await expect(dialog).toBeVisible();

	await dialog.getByRole("combobox").click();
	const listbox = page.getByRole("listbox").last();
	await expect(listbox).toBeVisible();
	await listbox.getByRole("option", { name: envTypeName }).first().click();
	await dialog.locator("#var-key").fill(key);
	await dialog.locator("#var-value").fill(value);

	const createResponse = waitForTrackedResponse(page, {
		method: "PUT",
		pathFragment: "/api/secret/single",
		expectedStatus: 201,
		failOnUnexpectedStatus: true,
	});
	await dialog.getByRole("button", { name: "Add Secret" }).click();

	const trackedResponse = await createResponse;
	expectObjectBody(trackedResponse.requestBody, "Create secret");
	expect(trackedResponse.requestBody.key).toBe(key);
	expect(trackedResponse.requestBody.value).toBe(value);
	expect(trackedResponse.requestBody.app_id).toBe(appId);
	expect(trackedResponse.requestBody.env_type_id).toBeTruthy();
	const envTypeId = String(trackedResponse.requestBody.env_type_id);
	await page.goto(getSecretsPath(appId, envTypeId), { waitUntil: "domcontentloaded" });
	await expect(page.locator("tr").filter({ hasText: key }).first()).toBeVisible();

	return envTypeId;
}

export async function updateSecret(page: Page, appId: string, envTypeId: string, key: string, nextValue: string) {
	await openRowActions(page, key);
	await page.getByRole("menuitem", { name: /Edit Secret|Edit Variable|Edit/i }).first().click();
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await expect(dialog.locator("#edit-var-key")).toBeDisabled();
	const clickToEditButton = dialog.getByRole("button", { name: "Click to edit" });
	if (await clickToEditButton.isVisible().catch(() => false)) {
		await clickToEditButton.click();
	} else {
		const revealButton = dialog.getByRole("button", { name: "Reveal" });
		if (await revealButton.isVisible().catch(() => false)) {
			await revealButton.click();
		}
	}
	await expect(dialog.locator("#edit-var-value")).toBeVisible();
	await dialog.locator("#edit-var-value").fill(nextValue);
	const updateResponse = waitForTrackedResponse(page, {
		method: "PATCH",
		pathFragment: `/api/secret/i/${key}`,
		expectedStatus: 200,
		failOnUnexpectedStatus: true,
	});
	await dialog.getByRole("button", { name: "Save Changes" }).click();

	const trackedResponse = await updateResponse;
	expectObjectBody(trackedResponse.requestBody, "Update secret");
	expect(trackedResponse.requestBody.app_id).toBe(appId);
	expect(trackedResponse.requestBody.env_type_id).toBe(envTypeId);
	expect(trackedResponse.requestBody.value).toBe(nextValue);
	await page.goto(getSecretsPath(appId, envTypeId), { waitUntil: "domcontentloaded" });
	await expect(page.locator("tr").filter({ hasText: key }).first()).toBeVisible();
}

export async function deleteSecret(page: Page, appId: string, envTypeId: string, key: string) {
	await openRowActions(page, key);
	const deleteMenuItem = page.getByRole("menuitem", { name: /Delete Secret|Delete Variable|Delete/i }).first();
	await deleteMenuItem.click();
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await dialog.locator("#delete-confirm").fill(key);

	const deleteResponse = waitForTrackedResponse(page, {
		method: "DELETE",
		pathFragment: "/api/secret",
		expectedStatus: 200,
		failOnUnexpectedStatus: true,
	});
	await dialog.getByRole("button", { name: /Delete Secret/ }).click();

	const trackedResponse = await deleteResponse;
	expectObjectBody(trackedResponse.requestBody, "Delete secret");
	expect(trackedResponse.requestBody.key).toBe(key);
	expect(trackedResponse.requestBody.app_id).toBe(appId);
	expect(trackedResponse.requestBody.env_type_id).toBe(envTypeId);
	await page.goto(getSecretsPath(appId, envTypeId), { waitUntil: "domcontentloaded" });
	await expect(page.locator("tr").filter({ hasText: key })).toHaveCount(0);
}
