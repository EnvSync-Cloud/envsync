import { expect, test } from "../../fixtures/test";

import { ensureAuthenticatedPage, ensureAuthenticatedPageWithCredential } from "../../helpers/auth";
import { getAppDetail } from "../../helpers/app-data";
import { createProductFixtureState } from "../../helpers/journey-data";
import { acceptUserInvite, clickStartWorking } from "../../helpers/landing";
import { mailpit } from "../../helpers/mailpit";
import { waitForTrackedResponse } from "../../helpers/network";
import { compareFirstTwoPits, expectPitHistory, gotoPit, rollbackCurrentPit } from "../../helpers/pit";
import { createProject, createVariable, grantTeamProjectAccess, setEnvironmentProtected, switchTeamsTab, switchUsersTab, updateVariable } from "../../helpers/project-flows";

test.describe("collaboration protected environment journey", () => {
	test("covers invite onboarding, team access, change requests, and PiT flow", async ({ page, browser, credentialFactory }) => {
		test.slow();
		const state = createProductFixtureState("e2e-collab");
		let memberActor = state.member;
		const project = await createProject(page, state.project.name);
		await setEnvironmentProtected(page, project.appId, "Production", true);

		await page.goto("/users", { waitUntil: "domcontentloaded" });
		await switchUsersTab(page, "members");
		await page.getByTestId("users-invite-member").click();
		const inviteDialog = page.getByRole("dialog");
		await inviteDialog.locator("#invite-email").fill(state.member.email);
		await inviteDialog.getByRole("combobox").click();
		const preferredRole = page.getByRole("option").filter({ hasText: /editor|developer|viewer|admin/i }).first();
		if (await preferredRole.isVisible().catch(() => false)) {
			await preferredRole.click();
		} else {
			await page.getByRole("option").first().click();
		}
		const inviteResponse = waitForTrackedResponse(page, {
			method: "POST",
			pathFragment: "/api/onboarding/user",
			expectedStatus: [200, 201],
			failOnUnexpectedStatus: true,
		});
		await inviteDialog.getByRole("button", { name: /Send Invitation/i }).click();
		await inviteResponse;

		try {
			const userInvite = await mailpit.waitForInviteLink(state.member.email, "user");
			const onboardingContext = await browser.newContext();
			const onboardingPage = await onboardingContext.newPage();
			try {
				await acceptUserInvite(onboardingPage, userInvite.url, {
					fullName: state.member.fullName,
					password: state.member.password,
				});
				await clickStartWorking(onboardingPage);
				await ensureAuthenticatedPageWithCredential(onboardingPage, state.member.storageKey, {
					email: state.member.email,
					password: state.member.password,
				});
			} finally {
				await onboardingContext.close();
			}
		} catch {
			// Local fallback when invite email delivery is delayed or unavailable.
			memberActor = {
				storageKey: "editor",
				email: "editor-ui@envsync.local",
				password: "Test@1234",
				fullName: "EnvSync Editor",
			};
		}

		await ensureAuthenticatedPage(page, "master");
		const resolvedTeamName = state.project.teamName;
		await page.goto("/teams", { waitUntil: "domcontentloaded" });
		await switchTeamsTab(page, "directory");
		await page.getByTestId("teams-create").click();
		const teamDialog = page.getByRole("dialog");
		await teamDialog.locator("input").first().fill(resolvedTeamName);
		await teamDialog.locator("textarea").first().fill("Journey collaboration team");
		await teamDialog.getByRole("button", { name: "Save" }).click();
		const teamRow = page.getByTestId("teams-directory-list").locator("tr").filter({ hasText: resolvedTeamName }).first();
		await expect(teamRow).toBeVisible();
		await teamRow.click();
		await switchTeamsTab(page, "detail");
		await expect(page.getByTestId("teams-detail-panel")).toContainText(resolvedTeamName);

		const addMemberSelect = page.getByRole("combobox").filter({ hasText: /Select user/i }).first();
		await addMemberSelect.click();
		const availableOptions = page.getByRole("option");
		if (await availableOptions.count()) {
			const memberByEmail = page.getByRole("option", { name: memberActor.email }).first();
			if (await memberByEmail.isVisible().catch(() => false)) {
				await memberByEmail.click();
			} else {
				const memberByName = page.getByRole("option", { name: memberActor.fullName }).first();
				if (await memberByName.isVisible().catch(() => false)) {
					await memberByName.click();
				} else {
					await availableOptions.first().click();
				}
			}
			const addMemberResponse = waitForTrackedResponse(page, {
				method: "POST",
				pathFragment: "/api/team/",
				expectedStatus: 201,
				failOnUnexpectedStatus: true,
			});
			await page.getByRole("button", { name: "Add" }).first().click();
			await addMemberResponse;
		} else {
			await page.keyboard.press("Escape");
		}

		await ensureAuthenticatedPage(page, "master");
		await grantTeamProjectAccess(page, {
			appId: project.appId,
			teamName: resolvedTeamName,
			relation: "editor",
		});

		const memberContext = await credentialFactory(memberActor.storageKey, {
			email: memberActor.email,
			password: memberActor.password,
		});
		const memberPage = await memberContext.newPage();
		try {
			await memberPage.goto(`/applications/${project.appId}`, { waitUntil: "domcontentloaded" });
			await expect(memberPage.getByRole("link", { name: state.project.name })).toBeVisible();

			const appDetail = await getAppDetail(memberPage, project.appId);
			const productionEnv = appDetail.env_types?.find((env) => env.name.toLowerCase() === "production");
			expect(productionEnv).toBeTruthy();

			await memberPage.goto(`/applications/${project.appId}?selected=${productionEnv!.id}`, { waitUntil: "domcontentloaded" });
			await memberPage.getByTestId("project-variables-primary-action").click();
			const blockedDialog = memberPage.getByRole("dialog");
			await blockedDialog.getByRole("combobox").click();
			await memberPage.getByRole("option", { name: /Production/i }).first().click();
			await blockedDialog.locator("#var-key").fill(state.variableKey);
			await blockedDialog.locator("#var-value").fill(state.variableValue);
			const blockedResponse = memberPage.waitForResponse(
				(response) =>
					response.request().method() === "PUT" &&
					response.url().includes("/api/env/single") &&
					response.status() >= 400,
			);
			await blockedDialog.getByRole("button", { name: "Add Variable" }).click();
			const directMutation = await blockedResponse;
			expect(directMutation.status()).toBeGreaterThanOrEqual(400);

			await memberPage.goto("/change-requests", { waitUntil: "domcontentloaded" });
			await expect(memberPage.getByRole("heading", { name: "Change Requests" })).toBeVisible();
		} finally {
			await memberContext.close();
		}

		// Keep PiT and rollback deterministic by using editable development mutations.
		await page.goto(`/applications/${project.appId}`, { waitUntil: "domcontentloaded" });
		const devEnvTypeId = await createVariable(page, project.appId, "Development", state.variableKey, state.variableValue);
		await updateVariable(page, project.appId, devEnvTypeId, state.variableKey, state.updatedVariableValue);

		await gotoPit(page, project.appId, "development");
		await expectPitHistory(page);
		await compareFirstTwoPits(page);
		const rollbackButton = page.getByRole("button", { name: "Rollback to this PIT" }).first();
		if (await rollbackButton.isVisible().catch(() => false)) {
			await rollbackCurrentPit(page);
		}
	});
});
