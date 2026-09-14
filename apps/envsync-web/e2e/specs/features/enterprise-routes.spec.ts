/**
 * H1.5 / Hosted cutover: enterprise dashboard modules must load (enterprise Vite build).
 * Shell-only OSS stubs would 404 these routes.
 */
import { getAppByName } from "../../helpers/app-data";
import { test, expect } from "../../fixtures/test";

test.describe("enterprise dashboard routes", () => {
	test("organisation integrations, license, sync ops, SSO, and key management pages load", async ({ page }) => {
		const routeChecks: Array<{ path: string; heading: RegExp | string }> = [
			{
				path: "/organisation/integrations",
				heading: /Shared provider connections|Integrations/i,
			},
			{
				path: "/organisation/license",
				heading: /License/i,
			},
			{
				path: "/organisation/sync",
				heading: /Sync operations|Sync/i,
			},
			{
				path: "/organisation/sso",
				heading: /^SSO$/,
			},
			{
				path: "/organisation/keys",
				heading: /^Key management$/,
			},
		];

		for (const routeCheck of routeChecks) {
			await page.goto(routeCheck.path, { waitUntil: "domcontentloaded" });
			await expect(page.getByRole("heading", { name: routeCheck.heading }).first()).toBeVisible({
				timeout: 30_000,
			});
			// Not a shell 404
			await expect(page.getByText(/not found|page you are looking for/i)).toHaveCount(0);
		}
	});

	test("project integrations page loads when a seeded app exists", async ({ page }) => {
		const seededApp = await getAppByName(page, "Core Platform");
		test.skip(!seededApp, "Core Platform app not seeded in this harness");

		await page.goto(`/applications/${seededApp!.id}/integrations`, {
			waitUntil: "domcontentloaded",
		});
		await expect(
			page.getByRole("heading", { name: /Integrations|Integration/i }).first(),
		).toBeVisible({ timeout: 30_000 });
		await expect(page.getByText(/not found|page you are looking for/i)).toHaveCount(0);
	});

	// Hosted-only grant-org-features would hide Integrations on a second harness org.
	// UI e2e is not Hosted-gated, so intercept whoami.features instead.
	test("restricted whoami features hide Integrations nav and deep-link to upgrade", async ({ page }) => {
		await page.route("**/api/auth/me", async route => {
			const response = await route.fetch();
			const body = await response.json() as { features?: string[] };
			const features = (body.features ?? []).filter(feature => feature !== "integrations");
			await route.fulfill({
				response,
				json: { ...body, features },
			});
		});

		await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
		await page.getByTestId("product-switcher-trigger").click();
		await page.getByTestId("product-switcher-item-organization").click();
		await expect(page.getByTestId("shell-nav-organisation-integrations")).toHaveCount(0);
		await expect(page.getByTestId("shell-nav-organisation-sync")).toHaveCount(0);
		await expect(page.getByTestId("shell-nav-organisation-license")).toBeVisible();
		await expect(page.getByTestId("shell-nav-organisation-sso")).toBeVisible();
		await expect(page.getByTestId("shell-nav-organisation-keys")).toBeVisible();

		await page.goto("/organisation", { waitUntil: "domcontentloaded" });
		await expect(page.getByTestId("shell-nav-organisation-integrations")).toHaveCount(0);
		await expect(page.getByTestId("shell-nav-organisation-sync")).toHaveCount(0);
		await expect(page.getByTestId("shell-nav-organisation-license")).toBeVisible();
		await expect(page.getByTestId("shell-nav-organisation-sso")).toBeVisible();
		await expect(page.getByTestId("shell-nav-organisation-keys")).toBeVisible();

		const seededApp = await getAppByName(page, "Core Platform");
		if (seededApp) {
			await page.goto(`/applications/${seededApp.id}`, { waitUntil: "domcontentloaded" });
			await expect(page.getByTestId("shell-nav-applications-integrations")).toHaveCount(0);
		}

		await page.goto("/organisation/integrations", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: /Integrations is not on this plan/i })).toBeVisible({
			timeout: 30_000,
		});
	});

	test("restricted whoami features hide SSO nav and deep-link to upgrade", async ({ page }) => {
		await page.route("**/api/auth/me", async route => {
			const response = await route.fetch();
			const body = await response.json() as { features?: string[] };
			const features = (body.features ?? []).filter(feature => feature !== "saml");
			await route.fulfill({
				response,
				json: { ...body, features },
			});
		});

		await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
		await page.getByTestId("product-switcher-trigger").click();
		await page.getByTestId("product-switcher-item-organization").click();
		await expect(page.getByTestId("shell-nav-organisation-sso")).toHaveCount(0);
		await expect(page.getByTestId("shell-nav-organisation-license")).toBeVisible();

		await page.goto("/organisation/sso", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: /SSO is not on this plan/i })).toBeVisible({
			timeout: 30_000,
		});
	});

	test("restricted whoami features hide Key management and deep-link to upgrade", async ({ page }) => {
		await page.route("**/api/auth/me", async route => {
			const response = await route.fetch();
			const body = await response.json() as { features?: string[] };
			const features = (body.features ?? []).filter(feature => feature !== "kms");
			await route.fulfill({
				response,
				json: { ...body, features },
			});
		});

		await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
		await page.getByTestId("product-switcher-trigger").click();
		await page.getByTestId("product-switcher-item-organization").click();
		await expect(page.getByTestId("shell-nav-organisation-keys")).toHaveCount(0);
		await expect(page.getByTestId("shell-nav-organisation-license")).toBeVisible();

		await page.goto("/organisation/keys", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: /Key management is not on this plan/i })).toBeVisible({
			timeout: 30_000,
		});
		await expect(page.getByText(/Existing encryption continues/i)).toBeVisible();
	});

	test("legacy /manage SPA path is not a live product surface", async ({ page }) => {
		await page.goto("/manage", { waitUntil: "domcontentloaded" });
		// SPA client router: expect not-found shell, not an old management dashboard chrome
		const notFound = page.getByText(/not found|page you are looking for/i);
		const manageHeading = page.getByRole("heading", { name: /management console|management dashboard/i });
		await expect(manageHeading).toHaveCount(0);
		// Prefer explicit not-found; if redirected home, still no management SPA chrome
		if ((await notFound.count()) === 0) {
			await expect(page).not.toHaveURL(/\/manage\/?$/);
		} else {
			await expect(notFound.first()).toBeVisible();
		}
	});
});
