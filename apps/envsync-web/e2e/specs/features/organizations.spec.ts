import { test, expect } from "../../fixtures/test";

async function getAuthSession(page: import("@playwright/test").Page) {
  return await page.evaluate(async () => {
    const runtimeConfig = window.__ENVSYNC_RUNTIME_CONFIG__ as { apiBaseUrl?: string } | undefined;
    const apiBaseUrl = runtimeConfig?.apiBaseUrl ?? window.location.origin;
    const response = await fetch(`${apiBaseUrl}/api/auth/me`, { credentials: "include" });
    if (!response.ok) {
      throw new Error(`Failed to load auth session: ${response.status}`);
    }
    return await response.json() as {
      org: { id: string; name: string; slug: string };
      memberships: Array<{ org_id: string; org_name: string; org_slug: string }>;
    };
  });
}

test.describe("organization switcher", () => {
  test("creates a new organization from the enterprise header switcher and can switch back", async ({ page, makeName }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const originalSession = await getAuthSession(page);
    const organizationName = makeName("Org");

    await page.getByTestId("organization-switcher-trigger").click();
    await expect(page.getByTestId("create-organization-action")).toBeVisible();
    await page.getByTestId("create-organization-action").click();

    await expect(page.getByTestId("create-organization-dialog")).toBeVisible();
    await page.getByTestId("create-organization-name-input").fill(organizationName);
    await page.getByTestId("create-organization-submit").click();

    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByTestId("organization-switcher-trigger")).toContainText(organizationName);

    const createdSession = await getAuthSession(page);
    expect(createdSession.org.name).toBe(organizationName);
    expect(createdSession.memberships.length).toBeGreaterThanOrEqual(2);

    await page.getByTestId("organization-switcher-trigger").click();
    await expect(page.getByTestId(`organization-switcher-item-${originalSession.org.slug}`)).toBeVisible();
    await expect(page.getByTestId(`organization-switcher-item-${createdSession.org.slug}`)).toBeVisible();

    await page.getByTestId(`organization-switcher-item-${originalSession.org.slug}`).click();
    await page.waitForURL("**/");
    await expect(page.getByTestId("organization-switcher-trigger")).toContainText(originalSession.org.name);
  });
});
