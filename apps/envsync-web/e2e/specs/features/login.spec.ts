import { expect, test, type Page } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const SSO_ERROR = "We couldn't start SSO for that organization.";

async function stubUnauthenticatedSession(page: Page) {
	await page.route("**/api/auth/me", async route => {
		await route.fulfill({
			status: 401,
			contentType: "application/json",
			body: JSON.stringify({ error: "Authentication required", code: "AUTH_MISSING" }),
		});
	});
}

test.describe("login chooser", () => {
	test("renders /login without a session and does not loop", async ({ page }) => {
		await stubUnauthenticatedSession(page);
		await page.goto("/login", { waitUntil: "domcontentloaded" });
		await expect(page.getByTestId("login-keycloak")).toBeVisible();
		await expect(page).toHaveURL(/\/login\/?$/);
	});

	test("?sso=failed shows the generic SSO error when SSO is available", async ({ page }) => {
		await stubUnauthenticatedSession(page);
		await page.goto("/login?sso=failed", { waitUntil: "domcontentloaded" });
		await expect(page.getByTestId("login-keycloak")).toBeVisible();

		const ssoError = page.getByTestId("login-sso-error");
		if (await page.getByTestId("login-sso-slug").isVisible().catch(() => false)) {
			await expect(ssoError).toHaveText(SSO_ERROR);
		} else {
			await expect(ssoError).toHaveCount(0);
		}
	});

	test("Continue with SSO POSTs JSON then assigns redirect_url", async ({ page }) => {
		const idpUrl = "https://idp.example.test/sso?SAMLRequest=abc";
		await stubUnauthenticatedSession(page);

		const ssoRequests: Array<{ method: string; url: string }> = [];
		await page.route("**/api/saml/sso/**", async route => {
			const request = route.request();
			ssoRequests.push({ method: request.method(), url: request.url() });
			if (request.method() !== "POST") {
				await route.fulfill({ status: 405, body: "method not allowed" });
				return;
			}
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ redirect_url: idpUrl, request_id: "req_1" }),
			});
		});
		await page.route(idpUrl, async route => {
			await route.fulfill({ status: 200, contentType: "text/plain", body: "idp" });
		});

		await page.goto("/login", { waitUntil: "domcontentloaded" });
		const slugField = page.getByTestId("login-sso-slug");
		test.skip(
			!(await slugField.isVisible().catch(() => false)),
			"SSO form hidden on OSS edition",
		);

		await slugField.fill("acme");
		await page.getByTestId("login-sso-submit").click();
		await page.waitForURL(idpUrl);
		expect(ssoRequests).toHaveLength(1);
		expect(ssoRequests[0].method).toBe("POST");
		expect(ssoRequests[0].url).toContain("/api/saml/sso/acme");
	});
});
