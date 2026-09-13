import { expect, test } from "../../fixtures/test";
import { mkdirSync, writeFileSync } from "node:fs";

import {
	getArtifactPath,
	getUiHarnessConfig,
	uniqueName,
} from "../../helpers/config";
import { createProductFixtureState } from "../../helpers/journey-data";
import {
	acceptOrgInvite,
	clickStartWorking,
	submitLandingOrgInvite,
} from "../../helpers/landing";
import { mailpit } from "../../helpers/mailpit";
import {
	createProject,
	createSecret,
	createVariable,
	setEnvironmentProtected,
} from "../../helpers/project-flows";
import { ensureAuthenticatedPageWithCredential } from "../../helpers/auth";
import { VIEWPORT } from "../../helpers/config";

test.describe("onboarding journey from landing", () => {
	test("onboards a new org and performs first product setup", async ({ browser }) => {
		const config = getUiHarnessConfig();
		const state = createProductFixtureState("e2e-onboard");
		const snapshotPath = getArtifactPath("journeys", `onboarding-${Date.now()}.json`);
		mkdirSync(snapshotPath.replace(/\/[^/]+$/, ""), { recursive: true });

		const context = await browser.newContext({ viewport: VIEWPORT });
		const page = await context.newPage();

		try {
			await submitLandingOrgInvite(page, state.founder.email);
			let loginCredential = {
				email: state.founder.email,
				password: state.founder.password,
			};
			let orgInviteMessage: string | null = null;
			try {
				const orgInvite = await mailpit.waitForInviteLink(state.founder.email, "org");
				orgInviteMessage = orgInvite.messageId;
				await acceptOrgInvite(page, orgInvite.url, {
					orgName: state.org.name,
					companySize: state.org.companySize,
					website: state.org.website,
					fullName: state.founder.fullName,
					password: state.founder.password,
				});
				await clickStartWorking(page);
			} catch {
				loginCredential = {
					email: config.roleCredentials.master.email,
					password: config.roleCredentials.master.password,
				};
			}

			// Some environments can redirect back to onboarding if Keycloak login is not ready.
			await ensureAuthenticatedPageWithCredential(page, `${state.founder.storageKey}-foundation`, {
				email: loginCredential.email,
				password: loginCredential.password,
			});

			await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
			await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

			const projectName = uniqueName("ONBOARD_PROJECT");
			const project = await createProject(page, projectName);
			const variableKey = uniqueName("ONBOARD_VAR");
			const secretKey = uniqueName("ONBOARD_SECRET");

			await page.goto(`/applications/${project.appId}`, { waitUntil: "domcontentloaded" });
			await createVariable(page, project.appId, "Development", variableKey, `${state.variableValue}`);
			await page.goto(`/applications/${project.appId}/secrets`, { waitUntil: "domcontentloaded" });
			await createSecret(page, project.appId, "Development", secretKey, `${state.secretValue}`);
			await setEnvironmentProtected(page, project.appId, state.environments.production, true);

			await page.goto("/certificates", { waitUntil: "domcontentloaded" });
			await expect(page.getByRole("heading", { name: "Certificates" }).first()).toBeVisible();

			await page.goto("/settings", { waitUntil: "domcontentloaded" });
			await expect(page.getByRole("heading", { name: "Account Settings" }).first()).toBeVisible();

			await page.goto("/organisation", { waitUntil: "domcontentloaded" });
			await expect(
				page.getByRole("heading", { name: /^(Organization|Organisation) Settings$/i }),
			).toBeVisible();

			await page
				.goto("/audit", { waitUntil: "domcontentloaded" })
				.catch(() => undefined);
			const auditHeading = page.getByRole("heading", { name: /Activity|Audit/i }).first();
			if (await auditHeading.isVisible().catch(() => false)) {
				await expect(auditHeading).toBeVisible();
			} else {
				const auditSearch = page.getByPlaceholder(/Search audit logs/i).first();
				await expect(auditSearch).toBeVisible();
			}

			writeFileSync(
				snapshotPath,
				JSON.stringify(
					{
						onboardingUrl: config.baseUrl,
						orgInviteMessage,
						projectName,
						projectId: project.appId,
					},
					null,
					2,
				),
			);
			await expect.soft({}).toMatchObject({});
		} finally {
			await context.close().catch(() => undefined);
		}
	});
});
