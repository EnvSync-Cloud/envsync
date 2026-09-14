import { getAppByName } from "../../helpers/app-data";
import { test, expect } from "../../fixtures/test";

test.describe("route surface", () => {
	test("visits the core module routes", async ({ page }) => {
		const seededApp = await getAppByName(page, "Core Platform");
		expect(seededApp).toBeTruthy();

		const routeChecks: Array<{ path: string; heading: RegExp | string }> = [
			{ path: "/dashboard", heading: "Dashboard" },
			{ path: "/projects", heading: "Projects" },
			{ path: "/projects/create", heading: "Create New Project" },
			{ path: `/projects/${seededApp!.id}`, heading: "Variables" },
			{ path: `/projects/${seededApp!.id}/secrets`, heading: "Secrets" },
			{ path: `/projects/${seededApp!.id}/manage-environments`, heading: /Manage Environments|Environments/ },
			{ path: `/projects/${seededApp!.id}/access`, heading: "Project Access" },
			{ path: `/projects/${seededApp!.id}/pit`, heading: "Core Platform" },
			{ path: "/org/roles", heading: "Roles" },
			{ path: "/org/users", heading: "Users" },
			{ path: "/org/teams", heading: "Teams" },
			{ path: "/org/change-requests", heading: "Change Requests" },
			{ path: "/settings", heading: "Account Settings" },
			{ path: "/organisation", heading: /^(Organization|Organisation) Settings$/i },
			{ path: "/org", heading: /^(Organization|Organisation) Settings$/i },
			// Enterprise modules (default Vite license ≠ oss). Full EE suite: features/enterprise-routes.spec.ts
			{ path: "/organisation/integrations", heading: /Shared provider connections|Integrations/i },
			{ path: "/organisation/license", heading: /License/i },
			{ path: "/organisation/sync", heading: /Sync operations|Sync/i },
			{ path: "/organisation/sso", heading: /^SSO$/ },
			{ path: "/organisation/keys", heading: /^Key management$/ },
			{ path: "/audit", heading: "Activity" },
			{ path: "/apikeys", heading: "API Keys" },
			{ path: "/org/webhooks", heading: "Webhooks" },
			{ path: "/gpgkeys", heading: "GPG Keys" },
			{ path: "/org/certificates", heading: "Certificates" },
			// Legacy paths still land on the same pages.
			{ path: "/applications", heading: "Projects" },
			{ path: `/applications/${seededApp!.id}`, heading: "Variables" },
			{ path: "/users", heading: "Users" },
			{ path: "/teams", heading: "Teams" },
			{ path: "/roles", heading: "Roles" },
			{ path: "/certificates", heading: "Certificates" },
			{ path: "/webhooks", heading: "Webhooks" },
			{ path: "/change-requests", heading: "Change Requests" },
		];

		for (const routeCheck of routeChecks) {
			await page.goto(routeCheck.path, { waitUntil: "domcontentloaded" });
			await expect(page.getByRole("heading", { name: routeCheck.heading }).first()).toBeVisible();
		}

		await page.goto("/definitely-not-a-real-page", { waitUntil: "domcontentloaded" });
		await expect(page.getByText(/not found|page you are looking for/i).first()).toBeVisible();
	});
});
