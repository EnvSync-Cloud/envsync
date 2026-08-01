/**
 * H1.5 / Hosted cutover: enterprise dashboard modules must load (enterprise Vite build).
 * Shell-only OSS stubs would 404 these routes.
 */
import { getAppByName } from "../../helpers/app-data";
import { test, expect } from "../../fixtures/test";

test.describe("enterprise dashboard routes", () => {
	test("organisation integrations, license, and sync ops pages load", async ({ page }) => {
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
