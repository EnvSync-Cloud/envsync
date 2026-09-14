import type { Page } from "@playwright/test";

import { expect, test } from "../../fixtures/test";
import { waitForTrackedResponse } from "../../helpers/network";

function getActiveCertificateRowsForEmail(page: Page, email: string) {
	return page.getByRole("row").filter({ hasText: email }).filter({ hasText: "Active" });
}

async function revokeActiveCertificatesForEmail(page: Page, email: string) {
	for (let attempts = 0; attempts < 10; attempts += 1) {
		const activeRow = getActiveCertificateRowsForEmail(page, email).first();
		if (!(await activeRow.isVisible().catch(() => false))) {
			return;
		}

		const serialText = (await activeRow.locator("code").first().textContent())?.trim() ?? "";
		await activeRow.getByTitle("Revoke").click();

		const revokeDialog = page.getByRole("dialog");
		await expect(revokeDialog.getByRole("heading", { name: "Revoke Certificate" })).toBeVisible();

		const revokeResponse = waitForTrackedResponse(page, {
			method: "POST",
			pathFragment: `/api/certificate/${serialText}/revoke`,
			expectedStatus: 200,
			failOnUnexpectedStatus: true,
		});
		await revokeDialog.getByRole("button", { name: /^Revoke$/i }).click();
		await revokeResponse;
		await expect(page.getByText("Certificate revoked").first()).toBeVisible();
		await expect(getActiveCertificateRowsForEmail(page, email).filter({ hasText: serialText })).toHaveCount(0);
	}

	throw new Error(`Timed out revoking all active certificates for ${email}`);
}

test.describe("feature: certificates", () => {
	test("opens issue/revoke certificate flows", async ({ page }) => {
		const targetEmail = "editor-ui@envsync.local";

		await page.goto("/org/certificates", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Certificates" }).first()).toBeVisible();

		const issueButton = page.getByRole("button", { name: /Issue Certificate/i }).first();
		if (await issueButton.isVisible().catch(() => false)) {
			await revokeActiveCertificatesForEmail(page, targetEmail);

			await issueButton.click();
			const issueDialog = page.getByRole("dialog");
			await expect(issueDialog.getByRole("heading", { name: "Issue Member Certificate" })).toBeVisible();
			await issueDialog.locator("input[list='certificate-user-emails']").fill(targetEmail);

			const issueResponse = waitForTrackedResponse(page, {
				method: "POST",
				pathFragment: "/api/certificate/issue",
				expectedStatus: 201,
				failOnUnexpectedStatus: true,
			});
			await issueDialog.getByRole("button", { name: /^Issue$/i }).click();
			await issueResponse;
			await expect(page.getByText(/(Member )?certificate issued successfully/i).first()).toBeVisible();

			await issueDialog.getByRole("button", { name: "Done" }).click();
			await revokeActiveCertificatesForEmail(page, targetEmail);
		}
	});
});
