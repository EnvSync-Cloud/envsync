import type { Page } from "@playwright/test";

import { getUiHarnessConfig } from "./config";

export async function mockWhoamiWithoutFeature(page: Page, feature: string) {
	const { apiBaseUrl } = getUiHarnessConfig();
	await page.route("**/api/auth/me", async (route) => {
		const response = await page.context().request.get(`${apiBaseUrl}/api/auth/me`);
		if (!response.ok()) {
			await route.continue();
			return;
		}
		const body = await response.json() as { features?: string[] };
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				...body,
				features: (body.features ?? []).filter((item) => item !== feature),
			}),
		});
	});
}
