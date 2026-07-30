import { getAppByName } from "../../helpers/app-data";
import { test, expect } from "../../fixtures/test";

test.describe("route surface", () => {
	test("visits the core module routes", async ({ page }) => {
		const seededApp = await getAppByName(page, "Core Platform");
		expect(seededApp).toBeTruthy();

		const routeChecks: Array<{ path: string; heading: RegExp | string }> = [
			{ path: "/dashboard", heading: "Dashboard" },
			{ path: "/applications", heading: "Projects" },
			{ path: "/applications/create", heading: "Create New Project" },
			{ path: `/applications/${seededApp!.id}`, heading: "Variables" },
			{ path: `/applications/${seededApp!.id}/secrets`, heading: "Secrets" },
			{ path: `/applications/${seededApp!.id}/manage-environments`, heading: /Manage Environments|Environments/ },
			{ path: `/applications/${seededApp!.id}/access`, heading: "Project Access" },
			{ path: `/applications/pit/${seededApp!.id}`, heading: "Core Platform" },
			{ path: "/roles", heading: "Roles" },
			{ path: "/users", heading: "Users" },
			{ path: "/teams", heading: "Teams" },
			{ path: "/change-requests", heading: "Change Requests" },
			{ path: "/settings", heading: "Account Settings" },
			{ path: "/organisation", heading: /Organization Settings|Organisation Settings/i },
			{ path: "/audit", heading: "Activity" },
			{ path: "/apikeys", heading: "API Keys" },
			{ path: "/webhooks", heading: "Webhooks" },
			{ path: "/gpgkeys", heading: "GPG Keys" },
			{ path: "/certificates", heading: "Certificates" },
		];

		for (const routeCheck of routeChecks) {
			await page.goto(routeCheck.path, { waitUntil: "domcontentloaded" });
			await expect(page.getByRole("heading", { name: routeCheck.heading }).first()).toBeVisible();
		}

		await page.goto("/definitely-not-a-real-page", { waitUntil: "domcontentloaded" });
		await expect(page.getByText(/not found|page you are looking for/i).first()).toBeVisible();
	});
});
