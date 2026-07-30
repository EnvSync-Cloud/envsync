import { expect, type Page } from "@playwright/test";

export async function gotoPit(
	page: Page,
	appId: string,
	envName = "production",
	kind: "variables" | "secrets" = "variables"
) {
	const basePath = kind === "secrets"
		? `/applications/pit/${appId}/secrets`
		: `/applications/pit/${appId}`;
	await page.goto(`${basePath}?env=${encodeURIComponent(envName.toLowerCase())}`, {
		waitUntil: "domcontentloaded",
	});
	await expect(page.getByText(/snapshot history|snapshots in selected range/i).first()).toBeVisible();
}

export async function expectPitHistory(page: Page) {
	await expect(
		page.getByRole("heading", {
			name: /snapshot history|snapshots in selected range/i,
		}).first(),
	).toBeVisible();
}

export async function compareFirstTwoPits(page: Page) {
	const previewButton = page.getByRole("button", { name: "Preview comparison" });
	if (!(await previewButton.isVisible().catch(() => false))) {
		await page.getByRole("radio", { name: "Snapshots" }).click();
	}
	await previewButton.click();
	await expect(page.getByRole("heading", { name: /snapshot diff/i })).toBeVisible();
	await expect(
		page.getByText(/Added:|Modified:|Deleted:|No net changes were found/i).first()
	).toBeVisible();
}

export async function openTimeRangeMode(page: Page) {
	await page.getByRole("radio", { name: "Time Range" }).click();
	await expect(page.getByRole("heading", { name: "Snapshots in selected range" })).toBeVisible();
}

export async function switchPitKind(page: Page, kind: "variables" | "secrets") {
	await page.getByRole("button", { name: kind === "secrets" ? "Secrets" : "Variables" }).click();
	await expect(page).toHaveURL(kind === "secrets" ? /\/applications\/pit\/.+\/secrets\?env=/ : /\/applications\/pit\/[^/]+\?env=/);
}

export async function previewTimeRangeDiff(page: Page) {
	await page.getByRole("button", { name: "Preview range diff" }).click();
	await expect(page.getByRole("heading", { name: /time-range net diff/i })).toBeVisible();
	await expect(
		page.getByText(/Added:|Modified:|Deleted:|No net changes were found/i).first()
	).toBeVisible();
}

export async function rollbackCurrentPit(page: Page) {
	const rows = page.locator("tbody tr");
	const rowCount = await rows.count();
	if (rowCount === 0) {
		return false;
	}

	const firstDataRow = rows.first();
	await firstDataRow.click();
	const rollbackButton = firstDataRow.getByRole("button", { name: /Rollback/i });
	await expect(rollbackButton).toBeEnabled();
	await rollbackButton.click();
	const dialog = page.getByRole("dialog").last();
	await expect(dialog.getByText("Type the exact PIT ID")).toBeVisible();
	const pitIdBadge = dialog.getByText(/^[0-9a-f-]{36}$/).first();
	const pitId = (await pitIdBadge.textContent())?.trim();
	if (!pitId) {
		throw new Error("Expected rollback dialog to render the PIT ID");
	}
	await expect(dialog.getByRole("button", { name: /Rollback/i })).toBeDisabled();
	await dialog.locator("#pit-rollback-confirm-id").fill(pitId);
	await expect(dialog.getByRole("button", { name: /Rollback/i })).toBeEnabled();
	await dialog.getByRole("button", { name: /Rollback/i }).click();
	await page.waitForTimeout(1000);
	return true;
}
