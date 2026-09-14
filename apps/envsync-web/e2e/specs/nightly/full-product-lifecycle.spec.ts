import { expect, test } from "../../fixtures/test";
import { getAppByName } from "../../helpers/app-data";

test.describe("nightly: full product lifecycle", () => {
	test("visits all top-level product surfaces in one authenticated session", async ({ page }) => {
		const seeded = await getAppByName(page, "Core Platform");
		expect(seeded).toBeTruthy();

		const routes = [
			"/dashboard",
			"/projects",
			"/projects/create",
			`/projects/${seeded!.id}`,
			`/projects/${seeded!.id}/secrets`,
			`/projects/${seeded!.id}/manage-environments`,
			`/projects/${seeded!.id}/access`,
			`/projects/${seeded!.id}/pit`,
			"/org/access/roles",
			"/org/access/users",
			"/org/access/teams",
			"/org/change-requests",
			"/apikeys",
			"/org/webhooks",
			"/gpgkeys",
			"/org/certificates",
			"/audit",
			"/settings",
			"/organisation",
		];

		for (const route of routes) {
			await page.goto(route, { waitUntil: "domcontentloaded" });
			await expect(page.locator("h1").first()).toBeVisible();
		}
	});
});

