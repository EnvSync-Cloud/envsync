import { expect, test } from "../../fixtures/test";
import { createProject, deleteProject, editProject } from "../../helpers/project-flows";

test.describe("feature: projects", () => {
	test("creates, edits, and deletes a project", async ({ page, makeName }) => {
		const projectName = makeName("UI_FEATURE_PROJECT");
		const nextName = makeName("UI_FEATURE_PROJECT_EDITED");

		await createProject(page, projectName);
		await editProject(page, projectName, nextName);
		await deleteProject(page, nextName);

		await page.goto("/projects", { waitUntil: "domcontentloaded" });
		await expect(page.getByText(nextName)).toHaveCount(0);
	});
});
