import fs from "node:fs";

export const DEPLOY_TAG_OPTIONS_BEGIN = "# BEGIN deploy-tag-options";
export const DEPLOY_TAG_OPTIONS_END = "# END deploy-tag-options";
export const DEPLOY_TAG_OPTION_LIMIT = 20;

const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)(?:-rc\.([1-9]\d*))?$/;

interface ReleaseTag {
	tag: string;
	major: number;
	minor: number;
	patch: number;
	rc: number | null;
}

function parseReleaseTag(tag: string): ReleaseTag | null {
	const match = RELEASE_TAG.exec(tag.trim());
	if (!match) return null;
	return {
		tag: match[0],
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
		rc: match[4] ? Number(match[4]) : null,
	};
}

function compareReleaseTags(left: ReleaseTag, right: ReleaseTag): number {
	if (left.major !== right.major) return right.major - left.major;
	if (left.minor !== right.minor) return right.minor - left.minor;
	if (left.patch !== right.patch) return right.patch - left.patch;
	const leftRc = left.rc ?? Number.POSITIVE_INFINITY;
	const rightRc = right.rc ?? Number.POSITIVE_INFINITY;
	return rightRc - leftRc;
}

/** Newest release tags, stable and rc. A stable tag sorts ahead of its own rcs. */
export function selectDeployTags(tags: string[], limit = DEPLOY_TAG_OPTION_LIMIT): string[] {
	const parsed = new Map<string, ReleaseTag>();
	for (const tag of tags) {
		const release = parseReleaseTag(tag);
		if (release) parsed.set(release.tag, release);
	}
	return [...parsed.values()].sort(compareReleaseTags).slice(0, limit).map(release => release.tag);
}

export function replaceDeployTagOptions(yaml: string, tags: string[]): string {
	const selected = selectDeployTags(tags);
	if (selected.length === 0) {
		throw new Error("No release tags to write into the production deploy dropdown.");
	}
	const newline = yaml.includes("\r\n") ? "\r\n" : "\n";
	const lines = yaml.split(/\r?\n/);
	const begin = lines.findIndex(line => line.includes(DEPLOY_TAG_OPTIONS_BEGIN));
	const end = lines.findIndex(line => line.includes(DEPLOY_TAG_OPTIONS_END));
	if (begin < 0 || end <= begin) {
		throw new Error("Production deploy workflow is missing the deploy tag option markers.");
	}
	const indent = /^(\s*)# END deploy-tag-options/.exec(lines[end] ?? "")?.[1] ?? "          ";
	const options = selected.map(tag => `${indent}- ${tag}`);
	return [...lines.slice(0, begin + 1), ...options, ...lines.slice(end)].join(newline);
}

function gitTags(): string[] {
	const result = Bun.spawnSync(["git", "tag", "--list", "v*"], {
		stdout: "pipe",
		stderr: "pipe",
	});
	if ((result.exitCode ?? 1) !== 0) {
		const stderr = result.stderr instanceof Uint8Array ? new TextDecoder().decode(result.stderr) : String(result.stderr ?? "");
		throw new Error(`git tag --list failed: ${stderr}`);
	}
	const stdout = result.stdout instanceof Uint8Array ? new TextDecoder().decode(result.stdout) : String(result.stdout ?? "");
	return stdout.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
}

function writeGithubOutput(changed: boolean): void {
	const output = process.env.GITHUB_OUTPUT;
	if (!output) return;
	fs.appendFileSync(output, `changed=${changed ? "true" : "false"}\n`);
}

if (import.meta.main) {
	const file = process.argv[2];
	if (!file) {
		console.error("Usage: bun run scripts/sync-deploy-tag-choices.ts <workflow.yml>");
		process.exit(1);
	}
	const before = fs.readFileSync(file, "utf8");
	const next = replaceDeployTagOptions(before, gitTags());
	if (next === before) {
		writeGithubOutput(false);
		console.log("Deploy tag dropdown is already current.");
		process.exit(0);
	}
	fs.writeFileSync(file, next);
	writeGithubOutput(true);
	console.log("Updated the production deploy tag dropdown.");
}
