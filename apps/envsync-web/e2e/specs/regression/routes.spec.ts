import { getAppByName } from "../../helpers/app-data";
import { test, expect } from "../../fixtures/test";

test.describe("route surface", () => {
	test("visits the core module routes", async ({ page }) => {
		const seededApp = await getAppByName(page, "Core Platform");
		expect(seededApp).toBeTruthy();

		const seededId = seededApp!.id;
		const routeChecks: Array<{ path: string; heading: RegExp | string; url?: RegExp }> = [
			{ path: "/dashboard", heading: "Dashboard" },
			{ path: "/projects", heading: "Projects" },
			{ path: "/projects/create", heading: "Create New Project" },
			{ path: `/projects/${seededId}`, heading: "Variables" },
			{ path: `/projects/${seededId}/secrets`, heading: "Secrets" },
			{ path: `/projects/${seededId}/manage-environments`, heading: /Manage Environments|Environments/ },
			{ path: `/projects/${seededId}/environments`, heading: /Manage Environments|Environments/ },
			{ path: `/projects/${seededId}/access`, heading: "Project Access" },
			{ path: `/projects/${seededId}/approvals`, heading: "Approvals" },
			{ path: `/projects/${seededId}/change-requests`, heading: "Approvals", url: new RegExp(`/projects/${seededId}/approvals`) },
			{ path: `/projects/${seededId}/settings`, heading: "Service Tokens", url: new RegExp(`/projects/${seededId}/settings/service-tokens`) },
			{ path: `/projects/${seededId}/settings/service-tokens`, heading: "Service Tokens" },
			{ path: `/projects/${seededId}/pit`, heading: "Core Platform" },
			{ path: "/org/access", heading: "Users", url: /\/org\/access\/users\/?$/ },
			{ path: "/org/access/users", heading: "Users" },
			{ path: "/org/access/teams", heading: "Teams" },
			{ path: "/org/access/roles", heading: "Roles" },
			{ path: "/org/roles", heading: "Roles", url: /\/org\/access\/roles\/?$/ },
			{ path: "/org/users", heading: "Users", url: /\/org\/access\/users\/?$/ },
			{ path: "/org/teams", heading: "Teams", url: /\/org\/access\/teams\/?$/ },
			{ path: "/org/change-requests", heading: "Change Requests" },
			{ path: "/settings", heading: "Account Settings" },
			{ path: "/organisation", heading: /^(Organization|Organisation) Settings$/i, url: /\/organisation\/?$/ },
			{ path: "/org", heading: /^(Organization|Organisation) Settings$/i, url: /\/org\/?$/ },
			// Enterprise modules (default Vite license ≠ oss). Full EE suite: features/enterprise-routes.spec.ts
			{ path: "/organisation/integrations", heading: /Shared provider connections|Integrations/i, url: /\/organisation\/integrations\/?$/ },
			{ path: "/organisation/license", heading: /License/i, url: /\/organisation\/license\/?$/ },
			{ path: "/organisation/sync", heading: /Sync operations|Sync/i, url: /\/organisation\/sync\/?$/ },
			{ path: "/organisation/sso", heading: /^SSO$/, url: /\/organisation\/sso\/?$/ },
			{ path: "/organisation/keys", heading: /^Key management$/, url: /\/organisation\/keys\/?$/ },
			{ path: "/audit", heading: "Activity" },
			{ path: "/apikeys", heading: "API Keys" },
			{ path: "/org/webhooks", heading: "Webhooks" },
			{ path: "/gpgkeys", heading: "GPG Keys" },
			{ path: "/org/certificates", heading: "Certificates" },
			{ path: `/applications/${seededId}/integrations`, heading: /Integrations|Integration/i, url: new RegExp(`/projects/${seededId}/integrations/?$`) },
			{ path: `/projects/${seededId}/integrations`, heading: /Integrations|Integration/i, url: new RegExp(`/projects/${seededId}/integrations/?$`) },
			// Legacy paths still land on the same pages.
			{ path: "/applications", heading: "Projects", url: /\/projects\/?$/ },
			{ path: "/applications/create", heading: "Create New Project", url: /\/projects\/create\/?$/ },
			{ path: `/applications/${seededId}`, heading: "Variables", url: new RegExp(`/projects/${seededId}(?:\\?|$)`) },
			{ path: `/applications/${seededId}/secrets`, heading: "Secrets", url: new RegExp(`/projects/${seededId}/secrets`) },
			{ path: `/applications/${seededId}/access`, heading: "Project Access", url: new RegExp(`/projects/${seededId}/access`) },
			{ path: `/applications/pit/${seededId}`, heading: "Core Platform", url: new RegExp(`/projects/${seededId}/pit`) },
			{ path: "/users", heading: "Users", url: /\/org\/users\/?$/ },
			{ path: "/teams", heading: "Teams", url: /\/org\/teams\/?$/ },
			{ path: "/roles", heading: "Roles", url: /\/org\/roles\/?$/ },
			{ path: "/certificates", heading: "Certificates", url: /\/org\/certificates\/?$/ },
			{ path: "/webhooks", heading: "Webhooks", url: /\/org\/webhooks\/?$/ },
			{ path: "/change-requests", heading: "Change Requests", url: /\/org\/change-requests\/?$/ },
		];

		for (const routeCheck of routeChecks) {
			await page.goto(routeCheck.path, { waitUntil: "domcontentloaded" });
			if (routeCheck.url) {
				await expect(page).toHaveURL(routeCheck.url);
			}
			await expect(page.getByRole("heading", { name: routeCheck.heading }).first()).toBeVisible();
		}

		await page.goto("/org/access/users", { waitUntil: "domcontentloaded" });
		await expect(page.getByTestId("org-access-tabs")).toBeVisible();
		await page.getByTestId("org-access-tab-teams").click();
		await expect(page).toHaveURL(/\/org\/access\/teams\/?$/);
		await expect(page.getByRole("heading", { name: "Teams" }).first()).toBeVisible();
		await page.getByTestId("org-access-tab-roles").click();
		await expect(page).toHaveURL(/\/org\/access\/roles\/?$/);
		await expect(page.getByRole("heading", { name: "Roles" }).first()).toBeVisible();

		await page.goto(`/applications/${seededId}?selected=keep-me`, { waitUntil: "domcontentloaded" });
		await expect(page).toHaveURL(new RegExp(`/projects/${seededId}\\?selected=keep-me`));

		await page.goto("/definitely-not-a-real-page", { waitUntil: "domcontentloaded" });
		await expect(page.getByText(/not found|page you are looking for/i).first()).toBeVisible();
	});
});
