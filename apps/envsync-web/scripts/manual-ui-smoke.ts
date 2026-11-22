import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium, type Browser, type BrowserContext, type Page, type Response } from "playwright";

const scriptDir = new URL(".", import.meta.url).pathname;
const appDir = path.resolve(scriptDir, "..");
const tmpDir = path.resolve(appDir, ".tmp");
const baseUrl = process.env.ENVSYNC_UI_BASE_URL ?? "http://app.lvh.me:8001";
const apiBaseUrl = process.env.ENVSYNC_UI_API_BASE_URL ?? "http://api.lvh.me:4000";
const storageStatePath =
  process.env.ENVSYNC_UI_STORAGE_STATE ?? path.resolve(tmpDir, "manual-auth.json");
const screenshotPath =
  process.env.ENVSYNC_UI_FAILURE_SCREENSHOT ?? path.resolve(tmpDir, "manual-ui-smoke-failure.png");
const slowMo = Number(process.env.ENVSYNC_UI_SLOW_MO_MS ?? "150");
const actionTimeoutMs = Number(process.env.ENVSYNC_UI_ACTION_TIMEOUT_MS ?? "30000");
const loginTimeoutMs = Number(process.env.ENVSYNC_UI_LOGIN_TIMEOUT_MS ?? "600000");
const headless = process.env.ENVSYNC_UI_HEADLESS === "1";
const freshLogin = process.env.ENVSYNC_UI_REQUIRE_FRESH_LOGIN === "1";
const keepOpen = process.env.ENVSYNC_UI_KEEP_OPEN === "1";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface TrackedResponse {
  response: Response;
  requestBody: JsonValue | null;
  responseBody: JsonValue | null;
}

function logStep(message: string) {
  console.log(`[ui-smoke] ${message}`);
}

function fail(message: string): never {
  throw new Error(message);
}

function ensureDirFor(filePath: string) {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

async function waitForService(url: string, label: string) {
  const startedAt = Date.now();
  const timeoutMs = 60_000;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // Service is still starting.
    }

    await Bun.sleep(1_000);
  }

  fail(`${label} did not become reachable at ${url} within ${timeoutMs}ms`);
}

async function isAuthenticated(page: Page) {
  try {
    return await page.evaluate(async (currentApiBaseUrl) => {
      try {
        const response = await fetch(`${currentApiBaseUrl}/api/auth/me`, {
          credentials: "include",
        });
        return response.ok;
      } catch {
        return false;
      }
    }, apiBaseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Execution context was destroyed") || message.includes("Target page, context or browser has been closed")) {
      return false;
    }
    throw error;
  }
}

async function saveStorageState(context: BrowserContext) {
  ensureDirFor(storageStatePath);
  await context.storageState({ path: storageStatePath });
  logStep(`Saved browser session to ${storageStatePath}`);
}

async function ensureAuthenticatedContext(browser: Browser) {
  if (!freshLogin && existsSync(storageStatePath)) {
    logStep(`Using saved browser session from ${storageStatePath}`);
    const context = await browser.newContext({
      storageState: storageStatePath,
      viewport: { width: 1600, height: 1000 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(actionTimeoutMs);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

    if (await isAuthenticated(page)) {
      return { context, page };
    }

    logStep("Saved session is stale; starting a fresh interactive login.");
    await context.close();
  }

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(actionTimeoutMs);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  logStep("Browser is open. Complete the login flow in the headed Chromium window.");
  const startedAt = Date.now();

  while (Date.now() - startedAt < loginTimeoutMs) {
    if (await isAuthenticated(page)) {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await saveStorageState(context);
      return { context, page };
    }

    await page.waitForTimeout(1_000);
  }

  fail(`Timed out waiting for interactive login after ${loginTimeoutMs}ms`);
}

async function waitForHeading(page: Page, text: RegExp | string) {
  await page.getByRole("heading", { name: text }).first().waitFor({ state: "visible" });
}

async function waitForTrackedResponse(
  page: Page,
  options: {
    method: string;
    pathFragment: string;
    expectedStatus: number;
  },
) {
  const response = await page.waitForResponse((candidate) => {
    return candidate.request().method() === options.method &&
      candidate.url().includes(options.pathFragment) &&
      candidate.status() === options.expectedStatus;
  });

  const postData = response.request().postData();
  let requestBody: JsonValue | null = null;
  if (postData) {
    requestBody = JSON.parse(postData) as JsonValue;
  }

  let responseBody: JsonValue | null = null;
  try {
    responseBody = await response.json() as JsonValue;
  } catch {
    responseBody = null;
  }

  return { response, requestBody, responseBody } satisfies TrackedResponse;
}

function assertObjectBody(body: JsonValue | null, label: string): asserts body is Record<string, JsonValue> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    fail(`${label} request body was not a JSON object`);
  }
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    fail(`${label} mismatch: expected ${String(expected)}, received ${String(actual)}`);
  }
}

async function openRowActions(page: Page, key: string) {
  const row = page.locator("tr").filter({ hasText: key }).first();
  await row.waitFor({ state: "visible" });
  await row.getByRole("button").last().click();
  return row;
}

async function createProject(page: Page) {
  const projectName = `UI Smoke ${Date.now()}`;

  await page.goto(`${baseUrl}/applications`, { waitUntil: "networkidle" });
  await waitForHeading(page, "Projects");
  await page.getByRole("button", { name: "Create Project" }).click();
  await waitForHeading(page, "Create New Project");

  await page.locator("#project-name").fill(projectName);
  await page.locator("#project-description").fill("Temporary project created by the manual UI smoke harness.");
  await page.getByRole("switch").click();
  await page.getByRole("button", { name: "Add Common Presets" }).click();
  const trackedResponsePromise = waitForTrackedResponse(page, {
    method: "POST",
    pathFragment: "/api/app",
    expectedStatus: 201,
  });

  await page.locator("form").getByRole("button", { name: "Create Project" }).click();
  const trackedResponse = await trackedResponsePromise;
  await page.waitForURL(/\/projects\/[^/]+$/);

  assertObjectBody(trackedResponse.responseBody, "Create project response");
  const appId = trackedResponse.responseBody.id;
  if (typeof appId !== "string" || appId.length === 0) {
    fail("Could not determine app id from project creation response");
  }

  await page.getByRole("button", { name: "Add Variable" }).waitFor({ state: "visible" });
  logStep(`Created smoke project "${projectName}" (${appId})`);

  return { appId, projectName };
}

async function createVariable(page: Page, appId: string, envTypeName: string, key: string, value: string) {
  await page.getByRole("button", { name: "Add Variable" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });

  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: envTypeName }).click();
  await dialog.locator("#var-key").fill(key);
  await dialog.locator("#var-value").fill(value);

  const trackedResponsePromise = waitForTrackedResponse(page, {
    method: "PUT",
    pathFragment: "/api/env/single",
    expectedStatus: 201,
  });

  await dialog.getByRole("button", { name: "Add Variable" }).click();
  const trackedResponse = await trackedResponsePromise;
  assertObjectBody(trackedResponse.requestBody, "Create env");
  assertEqual(trackedResponse.requestBody.key, key, "Create env key");
  assertEqual(trackedResponse.requestBody.value, value, "Create env value");
  assertEqual(trackedResponse.requestBody.app_id, appId, "Create env app_id");
  if (!trackedResponse.requestBody.env_type_id) {
    fail("Create env env_type_id was missing");
  }

  await page.locator("tr").filter({ hasText: key }).first().waitFor({ state: "visible" });
  return trackedResponse.requestBody.env_type_id;
}

async function updateVariable(page: Page, appId: string, envTypeId: string, key: string, nextValue: string) {
  await openRowActions(page, key);
  await page.getByRole("menuitem", { name: "Edit Variable" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });

  await dialog.locator("#edit-var-value").fill(nextValue);

  const trackedResponsePromise = waitForTrackedResponse(page, {
    method: "PATCH",
    pathFragment: `/api/env/i/${key}`,
    expectedStatus: 200,
  });

  await dialog.getByRole("button", { name: "Save Changes" }).click();
  const trackedResponse = await trackedResponsePromise;
  assertObjectBody(trackedResponse.requestBody, "Update env");
  assertEqual(trackedResponse.requestBody.value, nextValue, "Update env value");
  assertEqual(trackedResponse.requestBody.app_id, appId, "Update env app_id");
  assertEqual(trackedResponse.requestBody.env_type_id, envTypeId, "Update env env_type_id");

  await dialog.waitFor({ state: "hidden" });
  await page.locator("tr").filter({ hasText: key }).first().getByText(nextValue).waitFor({ state: "visible" });
}

async function deleteVariable(page: Page, appId: string, envTypeId: string, key: string) {
  await openRowActions(page, key);
  await page.getByRole("menuitem", { name: "Delete Variable" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await dialog.locator("#delete-confirm").fill(key);

  const trackedResponsePromise = waitForTrackedResponse(page, {
    method: "DELETE",
    pathFragment: "/api/env",
    expectedStatus: 200,
  });

  await dialog.getByRole("button", { name: "Delete Variable" }).click();
  const trackedResponse = await trackedResponsePromise;
  assertObjectBody(trackedResponse.requestBody, "Delete env");
  assertEqual(trackedResponse.requestBody.key, key, "Delete env key");
  assertEqual(trackedResponse.requestBody.app_id, appId, "Delete env app_id");
  assertEqual(trackedResponse.requestBody.env_type_id, envTypeId, "Delete env env_type_id");

  await page.locator("tr").filter({ hasText: key }).first().waitFor({ state: "hidden" });
}

async function switchToSecrets(page: Page) {
  await page.getByRole("button", { name: /Variables/ }).click();
  await page.getByRole("menuitem", { name: /Secrets/ }).click();
  await page.waitForURL(/\/applications\/[^/]+\/secrets$/);
  await page.getByRole("button", { name: "Add Secret" }).waitFor({ state: "visible" });
}

async function createSecret(page: Page, appId: string, envTypeName: string, key: string, value: string) {
  await page.getByRole("button", { name: "Add Secret" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });

  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: envTypeName }).click();
  await dialog.locator("#var-key").fill(key);
  await dialog.locator("#var-value").fill(value);

  const trackedResponsePromise = waitForTrackedResponse(page, {
    method: "PUT",
    pathFragment: "/api/secret/single",
    expectedStatus: 201,
  });

  await dialog.getByRole("button", { name: "Add Secret" }).click();
  const trackedResponse = await trackedResponsePromise;
  assertObjectBody(trackedResponse.requestBody, "Create secret");
  assertEqual(trackedResponse.requestBody.key, key, "Create secret key");
  assertEqual(trackedResponse.requestBody.value, value, "Create secret value");
  assertEqual(trackedResponse.requestBody.app_id, appId, "Create secret app_id");
  if (!trackedResponse.requestBody.env_type_id) {
    fail("Create secret env_type_id was missing");
  }

  await page.locator("tr").filter({ hasText: key }).first().waitFor({ state: "visible" });
  return trackedResponse.requestBody.env_type_id;
}

async function updateSecret(page: Page, appId: string, envTypeId: string, key: string, nextValue: string) {
  await openRowActions(page, key);
  await page.getByRole("menuitem", { name: "Edit Variable" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });

  await dialog.getByRole("button", { name: "Click to edit" }).click();
  await dialog.locator("#edit-var-value").fill(nextValue);

  const trackedResponsePromise = waitForTrackedResponse(page, {
    method: "PATCH",
    pathFragment: `/api/secret/i/${key}`,
    expectedStatus: 200,
  });

  await dialog.getByRole("button", { name: "Save Changes" }).click();
  const trackedResponse = await trackedResponsePromise;
  assertObjectBody(trackedResponse.requestBody, "Update secret");
  assertEqual(trackedResponse.requestBody.value, nextValue, "Update secret value");
  assertEqual(trackedResponse.requestBody.app_id, appId, "Update secret app_id");
  assertEqual(trackedResponse.requestBody.env_type_id, envTypeId, "Update secret env_type_id");

  await dialog.waitFor({ state: "hidden" });
  await page.locator("tr").filter({ hasText: key }).first().waitFor({ state: "visible" });
}

async function deleteSecret(page: Page, appId: string, envTypeId: string, key: string) {
  await openRowActions(page, key);
  await page.getByRole("menuitem", { name: "Delete Variable" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await dialog.locator("#delete-confirm").fill(key);

  const trackedResponsePromise = waitForTrackedResponse(page, {
    method: "DELETE",
    pathFragment: "/api/secret",
    expectedStatus: 200,
  });

  await dialog.getByRole("button", { name: "Delete Secret" }).click();
  const trackedResponse = await trackedResponsePromise;
  assertObjectBody(trackedResponse.requestBody, "Delete secret");
  assertEqual(trackedResponse.requestBody.key, key, "Delete secret key");
  assertEqual(trackedResponse.requestBody.app_id, appId, "Delete secret app_id");
  assertEqual(trackedResponse.requestBody.env_type_id, envTypeId, "Delete secret env_type_id");

  await page.locator("tr").filter({ hasText: key }).first().waitFor({ state: "hidden" });
}

async function runReadOnlyChecks(page: Page) {
  await page.goto(`${baseUrl}/certificates`, { waitUntil: "networkidle" });
  await waitForHeading(page, "Certificates");

  await page.goto(`${baseUrl}/settings`, { waitUntil: "networkidle" });
  await waitForHeading(page, "Account Settings");

  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  await waitForHeading(page, "Dashboard");
}

async function run() {
  ensureDirFor(storageStatePath);
  ensureDirFor(screenshotPath);

  logStep("Waiting for local API and web app.");
  await Promise.all([
    waitForService(baseUrl, "Web app"),
    waitForService(`${apiBaseUrl}/health`, "API"),
  ]);

  const browser = await chromium.launch({
    headless,
    slowMo,
  });

  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    const authenticated = await ensureAuthenticatedContext(browser);
    context = authenticated.context;
    page = authenticated.page;

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
    await waitForHeading(page, "Dashboard");

    const { appId } = await createProject(page);

    const variableKey = `UI_SMOKE_VAR_${Date.now()}`;
    const variableInitialValue = `value-${Date.now()}`;
    const variableNextValue = `${variableInitialValue}-updated`;
    const envTypeId = await createVariable(page, appId, "Development", variableKey, variableInitialValue);
    await updateVariable(page, appId, envTypeId, variableKey, variableNextValue);
    await deleteVariable(page, appId, envTypeId, variableKey);

    await switchToSecrets(page);

    const secretKey = `UI_SMOKE_SECRET_${Date.now()}`;
    const secretInitialValue = `secret-${Date.now()}`;
    const secretNextValue = `${secretInitialValue}-updated`;
    const secretEnvTypeId = await createSecret(page, appId, "Development", secretKey, secretInitialValue);
    await updateSecret(page, appId, secretEnvTypeId, secretKey, secretNextValue);
    await deleteSecret(page, appId, secretEnvTypeId, secretKey);

    await runReadOnlyChecks(page);

    await saveStorageState(context);
    logStep("Manual UI smoke completed successfully.");

    if (keepOpen) {
      logStep("Keeping the browser open because ENVSYNC_UI_KEEP_OPEN=1.");
      await new Promise(() => {});
    }
  } catch (error) {
    if (page) {
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
      logStep(`Saved failure screenshot to ${screenshotPath}`);
    }
    throw error;
  } finally {
    if (!keepOpen) {
      await context?.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }
  }
}

await run();
