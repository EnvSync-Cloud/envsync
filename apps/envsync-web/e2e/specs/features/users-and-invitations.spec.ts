import { expect, test } from "../../fixtures/test";
import { waitForTrackedResponse } from "../../helpers/network";
import { switchUsersTab } from "../../helpers/project-flows";

test.describe("feature: users and invitations", () => {
	test("invites a member and manages pending invitation", async ({ page, makeName }) => {
		const email = `${makeName("ui-invite").toLowerCase()}@envsync.local`;

		await page.goto("/org/access/users", { waitUntil: "domcontentloaded" });
		await expect(page.getByTestId("users-invite-member")).toBeVisible();

		await page.getByTestId("users-invite-member").click();
		const inviteDialog = page.getByRole("dialog");
		await inviteDialog.locator("#invite-email").fill(email);
		await inviteDialog.getByRole("combobox").click();
		await page.getByRole("option").first().click();

		const inviteResponse = waitForTrackedResponse(page, {
			method: "POST",
			pathFragment: "/api/onboarding/user",
			expectedStatus: [200, 201],
			failOnUnexpectedStatus: true,
		});
		await inviteDialog.getByRole("button", { name: /Send Invitation/i }).click();
		await inviteResponse;
		if (await inviteDialog.isVisible().catch(() => false)) {
			await page.keyboard.press("Escape");
		}

		await switchUsersTab(page, "invitations");
		await expect(page.getByTestId("users-invitations-panel")).toBeVisible();
		await expect(page.getByText(email).first()).toBeVisible();
	});
});
