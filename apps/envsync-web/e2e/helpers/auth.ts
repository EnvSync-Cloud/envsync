import { existsSync, mkdirSync } from "node:fs";
import type { Browser, BrowserContext, Cookie, Page } from "playwright";
import { chromium } from "playwright";

import { getStorageStatePath, getUiHarnessConfig, type RoleCredential, type UiRole, VIEWPORT } from "./config";

export interface AuthCredential {
	email: string;
	password: string;
}

interface SessionStatus {
	authenticated: boolean;
	authStatus: number | null;
	hasAccessToken: boolean;
	hasCsrfToken: boolean;
	cookieNames: string[];
	currentUrl: string;
	onAppOrigin: boolean;
	onAuthOrigin: boolean;
	onCallbackUrl: boolean;
	onLoginPage: boolean;
}

function ensureParentDir(filePath: string) {
	mkdirSync(filePath.replace(/\/[^/]+$/, ""), { recursive: true });
}

function isOnOrigin(url: string, origin: string) {
	try {
		return new URL(url).origin === new URL(origin).origin;
	} catch {
		return false;
	}
}

export async function waitForService(url: string, label: string) {
	const startedAt = Date.now();
	const timeoutMs = 60_000;

	while (Date.now() - startedAt < timeoutMs) {
		try {
			const response = await fetch(url, { redirect: "manual" });
			if (response.ok || response.status < 500) {
				return;
			}
		} catch {
			// Service still starting.
		}

		await Bun.sleep(1_000);
	}

	throw new Error(`${label} did not become reachable at ${url} within ${timeoutMs}ms`);
}

export async function waitForUiServices() {
	const config = getUiHarnessConfig();
	await waitForService(`${config.apiBaseUrl}/health`, "API");
	await waitForService(config.baseUrl, "Web app");
}

export function getSessionCookieInspectionUrls(
	baseUrl = getUiHarnessConfig().baseUrl,
	apiBaseUrl = getUiHarnessConfig().apiBaseUrl,
) {
	return [baseUrl, `${apiBaseUrl}/api/auth/me`];
}

function cookieDomainMatches(cookieDomain: string, hostname: string) {
	const normalizedCookieDomain = cookieDomain.replace(/^\./, "");
	return hostname === normalizedCookieDomain || hostname.endsWith(`.${normalizedCookieDomain}`);
}

export function hasAccessTokenCookie(
	cookies: Array<Pick<Cookie, "name" | "domain" | "path">>,
	apiBaseUrl = getUiHarnessConfig().apiBaseUrl,
) {
	const apiHostname = new URL(apiBaseUrl).hostname;
	return cookies.some(cookie =>
		cookie.name === "access_token"
		&& cookieDomainMatches(cookie.domain, apiHostname)
		&& cookie.path.startsWith("/api"),
	);
}

export function hasCsrfCookie(
	cookies: Array<Pick<Cookie, "name" | "domain" | "path">>,
	baseUrl = getUiHarnessConfig().baseUrl,
) {
	const baseHostname = new URL(baseUrl).hostname;
	return cookies.some(cookie =>
		cookie.name === "envsync_csrf"
		&& cookieDomainMatches(cookie.domain, baseHostname),
	);
}

async function getSessionCookies(context: BrowserContext) {
	const config = getUiHarnessConfig();
	return await context.cookies(getSessionCookieInspectionUrls(config.baseUrl, config.apiBaseUrl));
}

async function getAuthStatus(page: Page) {
	const { apiBaseUrl } = getUiHarnessConfig();
	try {
		const response = await page.context().request.get(`${apiBaseUrl}/api/auth/me`, {
			failOnStatusCode: false,
		});
		return response.status();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (
			message.includes("Execution context was destroyed")
			|| message.includes("Target page, context or browser has been closed")
			|| message.includes("net::ERR_ABORTED")
		) {
			return null;
		}
		throw error;
	}
}

export async function isAuthenticated(page: Page) {
	return (await getAuthStatus(page)) === 200;
}

function isOnAuthOrigin(page: Page) {
	const config = getUiHarnessConfig();
	try {
		const currentUrl = page.url();
		if (!currentUrl) {
			return false;
		}
		return new URL(currentUrl).origin === new URL(config.authUrl).origin;
	} catch {
		return false;
	}
}

function isOnCallbackUrl(page: Page) {
	const config = getUiHarnessConfig();
	try {
		const currentUrl = page.url();
		if (!currentUrl) {
			return false;
		}
		return currentUrl.startsWith(`${config.apiBaseUrl}/api/access/web/callback`)
			|| currentUrl.startsWith(`${config.baseUrl}/auth/callback`);
	} catch {
		return false;
	}
}

function isOnLoginPage(page: Page) {
	try {
		const currentUrl = page.url();
		if (!currentUrl) {
			return false;
		}
		return new URL(currentUrl).pathname === "/login";
	} catch {
		return false;
	}
}

async function hasRequiredSessionCookies(context: BrowserContext) {
	const config = getUiHarnessConfig();
	const cookies = await getSessionCookies(context);
	return hasAccessTokenCookie(cookies, config.apiBaseUrl) && hasCsrfCookie(cookies, config.baseUrl);
}

function getCurrentUrl(page: Page) {
	try {
		return page.url();
	} catch {
		return "";
	}
}

async function getSessionStatus(page: Page): Promise<SessionStatus> {
	const config = getUiHarnessConfig();
	const cookies = await getSessionCookies(page.context());
	const authStatus = await getAuthStatus(page);
	const currentUrl = getCurrentUrl(page);
	const hasAccessToken = hasAccessTokenCookie(cookies, config.apiBaseUrl);
	const hasCsrfToken = hasCsrfCookie(cookies, config.baseUrl);

	return {
		authenticated: authStatus === 200,
		authStatus,
		hasAccessToken,
		hasCsrfToken,
		cookieNames: [...new Set(cookies.map(cookie => cookie.name))].sort(),
		currentUrl,
		onAppOrigin: Boolean(currentUrl) && isOnOrigin(currentUrl, config.baseUrl),
		onAuthOrigin: isOnAuthOrigin(page),
		onCallbackUrl: isOnCallbackUrl(page),
		onLoginPage: isOnLoginPage(page),
	};
}

function formatSessionStatus(status: SessionStatus) {
	return [
		`url=${status.currentUrl || "(blank)"}`,
		`access_token=${status.hasAccessToken}`,
		`envsync_csrf=${status.hasCsrfToken}`,
		`auth_status=${status.authStatus ?? "unavailable"}`,
		`on_app_origin=${status.onAppOrigin}`,
		`on_auth_origin=${status.onAuthOrigin}`,
		`on_callback=${status.onCallbackUrl}`,
		`on_login=${status.onLoginPage}`,
		`cookies=${status.cookieNames.join(",") || "(none)"}`,
	].join(" ");
}

async function isSessionReady(page: Page) {
	const status = await getSessionStatus(page);
	return status.authenticated && status.hasAccessToken && status.hasCsrfToken;
}

async function settleAuthenticatedPage(page: Page) {
	const config = getUiHarnessConfig();
	const deadline = Date.now() + 15_000;
	let lastStatus = await getSessionStatus(page);

	while (Date.now() < deadline) {
		lastStatus = await getSessionStatus(page);
		if (lastStatus.authenticated && lastStatus.hasAccessToken && lastStatus.hasCsrfToken) {
			if (lastStatus.onAppOrigin && !lastStatus.onCallbackUrl && !lastStatus.onLoginPage) {
				return;
			}

			try {
				await page.goto(config.baseUrl, { waitUntil: "domcontentloaded" });
			} catch {
				// Continue retrying until redirect chain settles.
			}
		}

		await page.waitForTimeout(500);
	}

	throw new Error(`Authenticated session did not settle on the app origin within 15000ms (${formatSessionStatus(lastStatus)})`);
}

async function recoverSessionIntoApp(page: Page) {
	const config = getUiHarnessConfig();
	const status = await getSessionStatus(page);
	if (!status.hasAccessToken || !status.hasCsrfToken) {
		return false;
	}

	try {
		await page.goto(config.baseUrl, { waitUntil: "domcontentloaded" });
	} catch {
		return false;
	}

	try {
		await settleAuthenticatedPage(page);
	} catch {
		return false;
	}

	return await isSessionReady(page);
}

async function startWebLoginFromChooser(page: Page) {
	const config = getUiHarnessConfig();
	if (!isOnLoginPage(page)) {
		await page.goto(new URL("/login", config.baseUrl).toString(), { waitUntil: "domcontentloaded" });
	}

	const keycloakButton = page.getByTestId("login-keycloak");
	await keycloakButton.waitFor({ state: "visible", timeout: 10_000 });
	await Promise.all([
		page.waitForLoadState("domcontentloaded"),
		keycloakButton.click(),
	]);
}

async function startWebLoginFromApi(page: Page) {
	const config = getUiHarnessConfig();
	const response = await page.goto(`${config.apiBaseUrl}/api/access/web`, { waitUntil: "commit" });
	if (!response) {
		throw new Error("Failed to create web login: missing navigation response");
	}
	if (!response.ok()) {
		throw new Error(`Failed to create web login: ${response.status()} ${await response.text()}`);
	}
	const payload = await response.json() as { loginUrl?: string };
	if (!payload.loginUrl) {
		throw new Error("Web login response did not include a loginUrl");
	}

	await page.goto(payload.loginUrl, { waitUntil: "domcontentloaded" });
}

async function startWebLogin(page: Page) {
	try {
		await startWebLoginFromChooser(page);
		return;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`[ui-login] login chooser Keycloak bounce failed, falling back to API (${message})`);
	}

	await startWebLoginFromApi(page);
}

async function startLocalDevSession(page: Page, credential: AuthCredential) {
	const config = getUiHarnessConfig();
	let navigationError = "";
	let responseStatus: number | null = null;
	let responseBody = "";

	try {
		const params = new URLSearchParams({
			email: credential.email,
			password: credential.password,
		});
		const response = await page.goto(`${config.apiBaseUrl}/api/access/web/dev-session?${params.toString()}`, {
			waitUntil: "commit",
		});
		if (response) {
			responseStatus = response.status();
			if (!response.ok()) {
				responseBody = await response.text().catch(() => "");
			}
		}
	} catch (error) {
		navigationError = error instanceof Error ? error.message : String(error);
	}

	const status = await getSessionStatus(page);
	const diagnostic = [
		`status=${responseStatus ?? "null"}`,
		`url=${status.currentUrl || "(blank)"}`,
		`cookies=${status.cookieNames.join(",") || "(none)"}`,
		`auth_status=${status.authStatus ?? "unavailable"}`,
		navigationError ? `error=${navigationError}` : "",
		responseBody ? `body=${responseBody}` : "",
	].filter(Boolean).join(" ");

	if (status.authenticated && status.hasAccessToken && status.hasCsrfToken) {
		console.warn(`[ui-login] dev session bootstrap recovered ${diagnostic}`);
		return true;
	}

	if (responseStatus !== null || navigationError || responseBody) {
		console.warn(`[ui-login] dev session bootstrap incomplete ${diagnostic}`);
	}

	return false;
}

async function attemptLocalAutologin(page: Page, role: UiRole) {
	const config = getUiHarnessConfig();
	return attemptLocalAutologinWithCredential(page, config.roleCredentials[role]);
}

async function attemptLocalAutologinWithCredential(page: Page, credential: AuthCredential) {
	const config = getUiHarnessConfig();
	if (!config.allowLocalAutologin) {
		return false;
	}

	let currentUrl = "";
	try {
		currentUrl = page.url();
	} catch {
		return false;
	}

	if (!currentUrl) {
		return false;
	}

	const isLocalKeycloakPage = new URL(currentUrl).origin === new URL(config.authUrl).origin;
	if (!isLocalKeycloakPage) {
		return false;
	}

	const username = page.locator("#username");
	const password = page.locator("#password");
	const submit = page.locator("#kc-login");
	if (!await username.isVisible().catch(() => false)) {
		return false;
	}

	await username.fill(credential.email);
	await password.fill(credential.password);
	await Promise.all([
		page.waitForLoadState("domcontentloaded"),
		submit.click(),
	]);
	await settleAuthenticatedPage(page);
	return true;
}

async function saveStorageState(context: BrowserContext, storageKey: string) {
	const storageStatePath = getStorageStatePath(storageKey);
	ensureParentDir(storageStatePath);
	await context.storageState({ path: storageStatePath });
	return storageStatePath;
}

function buildAuthTimeoutError(credential: AuthCredential, timeoutMs: number, status: SessionStatus) {
	return new Error(`Timed out waiting for login for ${credential.email} after ${timeoutMs}ms (${formatSessionStatus(status)})`);
}

async function finalizeAuthenticatedSession(
	page: Page,
	storageKey: string,
	options: { persistStorage?: boolean } = {},
) {
	const status = await getSessionStatus(page);
	if (!status.authenticated || !status.hasAccessToken || !status.hasCsrfToken) {
		return false;
	}

	await settleAuthenticatedPage(page);
	await page.goto(getUiHarnessConfig().baseUrl, { waitUntil: "domcontentloaded" });
	if (options.persistStorage ?? true) {
		await saveStorageState(page.context(), storageKey);
	}
	return true;
}

async function ensureFreshCredentialContext(
	browser: Browser,
	storageKey: string,
	credential: AuthCredential,
) {
	const config = getUiHarnessConfig();
	const context = await browser.newContext({ viewport: VIEWPORT });
	const page = await context.newPage();
	page.setDefaultTimeout(config.actionTimeoutMs);
	await page.goto(config.baseUrl, { waitUntil: "domcontentloaded" });
	if (await finalizeAuthenticatedSession(page, storageKey, { persistStorage: true })) {
		return { context, page };
	}

	await startLocalDevSession(page, credential);
	if (await finalizeAuthenticatedSession(page, storageKey, { persistStorage: true })) {
		return { context, page };
	}

	await startWebLogin(page);

	const startedAt = Date.now();
	let lastStatus = await getSessionStatus(page);
	while (Date.now() - startedAt < config.loginTimeoutMs) {
		if (await finalizeAuthenticatedSession(page, storageKey, { persistStorage: true })) {
			return { context, page };
		}

		lastStatus = await getSessionStatus(page);
		if (lastStatus.onAuthOrigin) {
			await attemptLocalAutologinWithCredential(page, credential);
		} else if (lastStatus.hasAccessToken && lastStatus.hasCsrfToken) {
			await recoverSessionIntoApp(page);
		}

		lastStatus = await getSessionStatus(page);
		if (
			lastStatus.authenticated
			&& lastStatus.hasAccessToken
			&& lastStatus.hasCsrfToken
			&& await finalizeAuthenticatedSession(page, storageKey, { persistStorage: true })
		) {
			return { context, page };
		}

		await page.waitForTimeout(1_000);
	}

	throw buildAuthTimeoutError(credential, config.loginTimeoutMs, lastStatus);
}

async function ensureFreshRoleContext(browser: Browser, role: UiRole) {
	const config = getUiHarnessConfig();
	return ensureFreshCredentialContext(browser, role, config.roleCredentials[role]);
}

export async function ensureRoleStorageState(role: UiRole) {
	const config = getUiHarnessConfig();
	return ensureCredentialStorageState(role, config.roleCredentials[role]);
}

export async function ensureCredentialStorageState(storageKey: string, credential: AuthCredential) {
	const config = getUiHarnessConfig();
	const storageStatePath = getStorageStatePath(storageKey);
	let browser: Browser | null = null;

	try {
		browser = await chromium.launch({
			headless: config.headless,
			slowMo: config.slowMoMs > 0 ? config.slowMoMs : undefined,
		});

		if (!config.freshLogin && existsSync(storageStatePath)) {
			const context = await browser.newContext({
				storageState: storageStatePath,
				viewport: VIEWPORT,
			});
			const page = await context.newPage();
			page.setDefaultTimeout(config.actionTimeoutMs);
			await page.goto(config.baseUrl, { waitUntil: "domcontentloaded" });
			if (await isSessionReady(page)) {
				await settleAuthenticatedPage(page);
				await context.close();
				return storageStatePath;
			}
			await context.close();
		}

		const { context } = await ensureFreshCredentialContext(browser, storageKey, credential);
		await context.close();
		return storageStatePath;
	} finally {
		if (browser && !config.keepOpen) {
			await browser.close();
		}
	}
}

export async function ensureRoleStorageStates(roles: UiRole[]) {
	for (const role of roles) {
		await ensureRoleStorageState(role);
	}
}

export async function createRoleContext(browser: Browser, role: UiRole) {
	return createStoredContext(browser, role);
}

export async function createStoredContext(browser: Browser, storageKey: string) {
	return browser.newContext({
		storageState: getStorageStatePath(storageKey),
		viewport: VIEWPORT,
	});
}

export async function ensureAuthenticatedPage(page: Page, role: UiRole = "master") {
	const config = getUiHarnessConfig();
	await ensureAuthenticatedPageWithCredential(page, role, config.roleCredentials[role]);
}

export async function ensureAuthenticatedPageWithCredential(
	page: Page,
	storageKey: string,
	credential: AuthCredential,
) {
	const config = getUiHarnessConfig();
	page.setDefaultTimeout(config.actionTimeoutMs);
	await page.goto(config.baseUrl, { waitUntil: "domcontentloaded" });
	if (await finalizeAuthenticatedSession(page, storageKey, { persistStorage: false })) {
		return;
	}

	const startedAt = Date.now();
	let lastStatus = await getSessionStatus(page);

	await startLocalDevSession(page, credential);
	if (await finalizeAuthenticatedSession(page, storageKey, { persistStorage: false })) {
		return;
	}

	await startWebLogin(page);

	while (Date.now() - startedAt < config.loginTimeoutMs) {
		if (await finalizeAuthenticatedSession(page, storageKey, { persistStorage: false })) {
			return;
		}

		lastStatus = await getSessionStatus(page);
		if (lastStatus.onAuthOrigin) {
			await attemptLocalAutologinWithCredential(page, credential);
		} else if (lastStatus.hasAccessToken && lastStatus.hasCsrfToken) {
			await recoverSessionIntoApp(page);
		}

		lastStatus = await getSessionStatus(page);
		if (
			lastStatus.authenticated
			&& lastStatus.hasAccessToken
			&& lastStatus.hasCsrfToken
			&& await finalizeAuthenticatedSession(page, storageKey, { persistStorage: false })
		) {
			return;
		}

		await page.waitForTimeout(1_000);
	}

	throw buildAuthTimeoutError(credential, config.loginTimeoutMs, lastStatus);
}

export function getSeededCredential(role: UiRole): RoleCredential {
	return getUiHarnessConfig().roleCredentials[role];
}
