import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { levelFromCommits } from "./release-autobump.ts";

const PACKAGE_REL_PATHS = [
	"package.json",
	"packages/deploy/package.json",
	"packages/deploy-cli/package.json",
	"packages/deploy-core/package.json",
	"packages/envsync-api/package.json",
	"packages/envsync-enterprise/package.json",
	"packages/envsync-enterprise-web/package.json",
	"packages/envsync-kernel/package.json",
	"packages/envsync-ui/package.json",
	"apps/envsync-landing/package.json",
	"apps/envsync-web/package.json",
	"sdks/envsync-ts-sdk/package.json",
] as const;

const OPENAPI_REL_PATHS = [
	"sdks/envsync-ts-sdk/openapi.json",
	"sdks/envsync-go-sdk/openapi.json",
] as const;

const BOT_NAME = "release[bot]";
const BOT_EMAIL = "1+release[bot]@users.noreply.github.com";

interface Repo {
	root: string;
	bare: string;
	work: string;
}

interface RunResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

interface PrEntry {
	number: number;
	title: string;
	labels?: string[];
}

function childEnv(extra: Record<string, string> = {}): Record<string, string> {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (typeof value !== "string") continue;
		if (key === "RELEASE_BUMP_ROOT" || key === "RELEASE_AUTOBUMP_TEST_BEFORE_PUSH") continue;
		env[key] = value;
	}
	env.GIT_AUTHOR_NAME = "human";
	env.GIT_AUTHOR_EMAIL = "human@example.com";
	env.GIT_COMMITTER_NAME = "human";
	env.GIT_COMMITTER_EMAIL = "human@example.com";
	env.GIT_CONFIG_COUNT = "2";
	env.GIT_CONFIG_KEY_0 = "commit.gpgsign";
	env.GIT_CONFIG_VALUE_0 = "false";
	env.GIT_CONFIG_KEY_1 = "tag.gpgsign";
	env.GIT_CONFIG_VALUE_1 = "false";
	return { ...env, ...extra };
}

function git(cwd: string, args: string[]): string {
	const result = spawnSync("git", ["-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false", ...args], {
		cwd,
		env: childEnv(),
		encoding: "utf8",
	});
	if (result.status !== 0) {
		throw new Error(`git ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
	}
	return (result.stdout ?? "").trimEnd();
}

function writeLockstep(work: string): void {
	for (const relPath of PACKAGE_REL_PATHS) {
		const absPath = path.join(work, relPath);
		fs.mkdirSync(path.dirname(absPath), { recursive: true });
		fs.writeFileSync(absPath, '{\n  "name": "lockstep",\n  "version": "0.25.3"\n}\n');
	}
	for (const relPath of OPENAPI_REL_PATHS) {
		const absPath = path.join(work, relPath);
		fs.mkdirSync(path.dirname(absPath), { recursive: true });
		fs.writeFileSync(
			absPath,
			'{\n  "openapi": "3.1.0",\n  "info": {\n    "title": "EnvSync API",\n    "version": "0.25.3"\n  }\n}\n',
		);
	}
	const scriptsDir = path.join(work, "scripts");
	fs.mkdirSync(scriptsDir, { recursive: true });
	fs.copyFileSync(path.join(import.meta.dir, "bump-release-version.ts"), path.join(scriptsDir, "bump-release-version.ts"));
	fs.copyFileSync(path.join(import.meta.dir, "release-autobump.ts"), path.join(scriptsDir, "release-autobump.ts"));
}

function initRepo(): Repo {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-ac2-"));
	const bare = path.join(root, "origin.git");
	const work = path.join(root, "work");
	git(root, ["init", "--bare", "-b", "dev", bare]);
	git(bare, ["config", "core.logAllRefUpdates", "true"]);
	git(bare, ["config", "receive.denyNonFastForwards", "true"]);
	git(root, ["init", "-b", "dev", work]);
	git(work, ["config", "user.name", "human"]);
	git(work, ["config", "user.email", "human@example.com"]);
	git(work, ["config", "commit.gpgsign", "false"]);
	git(work, ["config", "tag.gpgsign", "false"]);
	writeLockstep(work);
	fs.writeFileSync(path.join(work, "notes.txt"), "seed\n");
	git(work, ["add", "."]);
	git(work, ["commit", "-m", "seed"]);
	git(work, ["tag", "-a", "v0.25.3", "-m", "Release v0.25.3"]);
	git(work, ["remote", "add", "origin", bare]);
	git(work, ["push", "origin", "dev", "--tags"]);
	git(bare, ["symbolic-ref", "HEAD", "refs/heads/dev"]);
	return { root, bare, work };
}

function removeRepo(repo: Repo): void {
	fs.rmSync(repo.root, { recursive: true, force: true });
}

function commitOnDev(work: string, message: string): string {
	fs.appendFileSync(path.join(work, "notes.txt"), `${message}\n`);
	git(work, ["add", "notes.txt"]);
	git(work, ["commit", "-m", message]);
	const sha = git(work, ["rev-parse", "HEAD"]);
	git(work, ["push", "origin", "dev"]);
	return sha;
}

function writePrs(file: string, entries: Record<string, PrEntry>): void {
	const map: Record<string, unknown> = {};
	for (const [sha, entry] of Object.entries(entries)) {
		map[sha] = {
			number: entry.number,
			base: "dev",
			merged: true,
			labels: entry.labels ?? [],
			title: entry.title,
			merge_commit_sha: sha,
		};
	}
	fs.writeFileSync(file, `${JSON.stringify(map)}\n`);
}

function runCli(work: string, prsFile: string, eventSha?: string, extraEnv: Record<string, string> = {}): RunResult {
	const args = [
		"bun",
		"run",
		"scripts/release-autobump.ts",
		"run",
		"--remote",
		"origin",
		"--branch",
		"dev",
		"--bot-name",
		BOT_NAME,
		"--bot-email",
		BOT_EMAIL,
		"--prs-json",
		prsFile,
	];
	if (eventSha) args.push("--event-sha", eventSha);
	const result = spawnSync(args[0]!, args.slice(1), {
		cwd: work,
		env: childEnv(extraEnv),
		encoding: "utf8",
	});
	return {
		exitCode: result.status ?? 1,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

function assertOk(result: RunResult): void {
	if (result.exitCode !== 0) {
		throw new Error(`exit ${result.exitCode}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
	}
}

function lines(text: string): string[] {
	return text.split("\n").map(line => line.trimEnd()).filter(line => line.length > 0);
}

function devTip(bare: string): string {
	return git(bare, ["rev-parse", "refs/heads/dev"]);
}

function assertFirstParentLinear(bare: string): void {
	const listed = git(bare, ["rev-list", "--first-parent", "refs/heads/dev"]);
	const shas = listed.split("\n").filter(sha => sha.length > 0);
	expect(shas.length).toBeGreaterThan(1);
	for (let i = 0; i < shas.length - 1; i++) {
		expect(git(bare, ["rev-parse", `${shas[i]}^`])).toBe(shas[i + 1]);
	}
}

function assertReflogFastForward(bare: string): void {
	const result = spawnSync(
		"git",
		["-C", bare, "log", "-g", "--format=%H", "refs/heads/dev"],
		{ encoding: "utf8" },
	);
	if (result.status !== 0) {
		throw new Error(`origin reflog missing:\n${result.stderr}`);
	}
	const shas = (result.stdout ?? "").split("\n").filter(sha => sha.length > 0);
	expect(shas.length).toBeGreaterThan(0);
	for (let i = 0; i < shas.length - 1; i++) {
		const ancestor = spawnSync("git", ["-C", bare, "merge-base", "--is-ancestor", shas[i + 1]!, shas[i]!]);
		expect(ancestor.status).toBe(0);
	}
}

function assertTagCreatedOnce(bare: string, tag: string, commit: string): void {
	expect(git(bare, ["rev-parse", `${tag}^{commit}`])).toBe(commit);
	const reflog = spawnSync("git", ["-C", bare, "log", "-g", "--format=%H", `refs/tags/${tag}`], {
		encoding: "utf8",
	});
	if (reflog.status === 0) {
		const shas = (reflog.stdout ?? "").split("\n").filter(sha => sha.length > 0);
		// Bare repos log branch tips, not tags, unless a tag reflog already exists.
		if (shas.length > 0) expect(new Set(shas).size).toBe(1);
	}
}

test("fixture AC2-d1-levels: conventional commits and labels pick the bump level", () => {
	expect(levelFromCommits([], [])).toBe("patch");
	expect(levelFromCommits(["chore: tidy the repo"], [])).toBe("patch");
	expect(levelFromCommits(["fix: close a gap"], [])).toBe("patch");
	expect(levelFromCommits(["perf: speed up reads"], [])).toBe("patch");
	expect(levelFromCommits(["revert: drop the bad change"], [])).toBe("patch");
	expect(levelFromCommits(["feat: add projects"], [])).toBe("minor");
	expect(levelFromCommits(["feat(api): add projects"], [])).toBe("minor");
	expect(levelFromCommits(["fix!: drop the old route"], [])).toBe("major");
	expect(levelFromCommits(["feat(api)!: replace the route"], [])).toBe("major");
	expect(levelFromCommits(["fix: close a gap\n\nBREAKING CHANGE: clients must send a team id"], [])).toBe("major");
	expect(levelFromCommits(["fix: close a gap", "feat: add projects"], [])).toBe("minor");
	expect(levelFromCommits(["feat: add projects\n\nBREAKING CHANGE: new id shape"], ["release:patch"])).toBe("major");
	expect(levelFromCommits(["fix: close a gap"], ["release:minor"])).toBe("minor");
	expect(levelFromCommits(["feat: add projects"], ["release:patch"])).toBe("minor");
	expect(levelFromCommits(["chore: tidy"], ["release:minor", "release:major"])).toBe("major");
	expect(levelFromCommits(["fix: close a gap"], ["bug", "release:patch"])).toBe("patch");
});

test("fixture AC2-bootstrap: 0.25.3 stable + fix merge -> v0.25.4-rc.1", () => {
	const repo = initRepo();
	try {
		const sha = commitOnDev(repo.work, "fix: close the gap");
		const prs = path.join(repo.root, "prs.json");
		writePrs(prs, { [sha]: { number: 12, title: "fix: close the gap" } });
		const result = runCli(repo.work, prs, sha);
		assertOk(result);
		const bump = devTip(repo.bare);
		expect(lines(result.stdout)).toContain(`released v0.25.4-rc.1 at ${bump} for ${sha} (#12)`);
		expect(git(repo.bare, ["log", "-1", "--format=%s", bump])).toBe("chore: release version 0.25.4-rc.1");
		expect(git(repo.bare, ["log", "-1", "--format=%an", bump])).toBe(BOT_NAME);
		expect(git(repo.bare, ["log", "-1", "--format=%b", bump])).toContain(`Release-Source: ${sha}`);
		expect(git(repo.bare, ["log", "-1", "--format=%b", bump])).toContain("Release-PR: #12");
		expect(git(repo.bare, ["rev-parse", `${bump}^`])).toBe(sha);
		expect(git(repo.bare, ["cat-file", "-t", "v0.25.4-rc.1"])).toBe("tag");
		expect(git(repo.bare, ["tag", "-l", "--format=%(contents:subject)", "v0.25.4-rc.1"])).toBe("Release v0.25.4-rc.1");
		expect(git(repo.bare, ["show", `${bump}:package.json`])).toContain('"version": "0.25.4-rc.1"');
		assertTagCreatedOnce(repo.bare, "v0.25.4-rc.1", bump);
		assertFirstParentLinear(repo.bare);
		assertReflogFastForward(repo.bare);
	} finally {
		removeRepo(repo);
	}
}, 60_000);

test("fixture AC2-rc-increment: second merge for 0.25.4 -> v0.25.4-rc.2", () => {
	const repo = initRepo();
	try {
		const first = commitOnDev(repo.work, "fix: close the gap");
		const prs = path.join(repo.root, "prs.json");
		writePrs(prs, { [first]: { number: 12, title: "fix: close the gap" } });
		assertOk(runCli(repo.work, prs, first));
		const second = commitOnDev(repo.work, "fix: close the next gap");
		writePrs(prs, {
			[first]: { number: 12, title: "fix: close the gap" },
			[second]: { number: 13, title: "fix: close the next gap", labels: ["release:patch"] },
		});
		const result = runCli(repo.work, prs, second);
		assertOk(result);
		const bump = devTip(repo.bare);
		expect(lines(result.stdout)).toContain(`released v0.25.4-rc.2 at ${bump} for ${second} (#13)`);
		expect(git(repo.bare, ["rev-parse", "v0.25.4-rc.2^{commit}"])).toBe(bump);
		expect(git(repo.bare, ["show", `${bump}:package.json`])).toContain('"version": "0.25.4-rc.2"');
		expect(git(repo.bare, ["merge-base", "--is-ancestor", "v0.25.4-rc.1", bump])).toBe("");
		assertTagCreatedOnce(repo.bare, "v0.25.4-rc.1", git(repo.bare, ["rev-parse", "v0.25.4-rc.1^{commit}"]));
		assertTagCreatedOnce(repo.bare, "v0.25.4-rc.2", bump);
		assertFirstParentLinear(repo.bare);
	} finally {
		removeRepo(repo);
	}
}, 60_000);

test("fixture AC2-line-rises: feat after 0.25.4-rc.2 -> v0.26.0-rc.1", () => {
	const repo = initRepo();
	try {
		const first = commitOnDev(repo.work, "fix: close the gap");
		const prs = path.join(repo.root, "prs.json");
		writePrs(prs, { [first]: { number: 12, title: "fix: close the gap" } });
		assertOk(runCli(repo.work, prs, first));
		const second = commitOnDev(repo.work, "fix: close the next gap");
		writePrs(prs, {
			[first]: { number: 12, title: "fix: close the gap" },
			[second]: { number: 13, title: "fix: close the next gap" },
		});
		assertOk(runCli(repo.work, prs, second));
		const rc2 = git(repo.bare, ["rev-parse", "v0.25.4-rc.2^{commit}"]);
		const feat = commitOnDev(repo.work, "feat: add projects");
		writePrs(prs, {
			[first]: { number: 12, title: "fix: close the gap" },
			[second]: { number: 13, title: "fix: close the next gap" },
			[feat]: { number: 14, title: "feat: add projects" },
		});
		const result = runCli(repo.work, prs, feat);
		assertOk(result);
		const bump = devTip(repo.bare);
		expect(lines(result.stdout)).toContain(`released v0.26.0-rc.1 at ${bump} for ${feat} (#14)`);
		expect(git(repo.bare, ["show", `${bump}:package.json`])).toContain('"version": "0.26.0-rc.1"');
		expect(git(repo.bare, ["rev-parse", "v0.25.4-rc.2^{commit}"])).toBe(rc2);
		assertTagCreatedOnce(repo.bare, "v0.26.0-rc.1", bump);
		assertFirstParentLinear(repo.bare);
	} finally {
		removeRepo(repo);
	}
}, 60_000);

test("fixture AC2-own-commit-skip: a release bump commit at the tip is skipped", () => {
	const repo = initRepo();
	try {
		const sha = commitOnDev(repo.work, "fix: close the gap");
		const prs = path.join(repo.root, "prs.json");
		writePrs(prs, { [sha]: { number: 12, title: "fix: close the gap" } });
		assertOk(runCli(repo.work, prs, sha));
		const tip = devTip(repo.bare);
		const tagsBefore = git(repo.bare, ["tag", "--list"]);
		const result = runCli(repo.work, prs);
		assertOk(result);
		expect(lines(result.stdout)).toContain(`skip: tip ${tip} is a release bump commit; nothing to do`);
		expect(devTip(repo.bare)).toBe(tip);
		expect(git(repo.bare, ["tag", "--list"])).toBe(tagsBefore);
	} finally {
		removeRepo(repo);
	}
}, 60_000);

test("fixture AC2-non-merge-skip: a direct push that is not a merged PR is skipped", () => {
	const repo = initRepo();
	try {
		const sha = commitOnDev(repo.work, "wip: direct push");
		const prs = path.join(repo.root, "prs.json");
		writePrs(prs, {});
		const result = runCli(repo.work, prs, sha);
		assertOk(result);
		expect(lines(result.stdout)).toContain(`skip: ${sha} is not a merged pull request into dev`);
		expect(devTip(repo.bare)).toBe(sha);
		expect(git(repo.bare, ["tag", "--list", "v*-rc.*"])).toBe("");
	} finally {
		removeRepo(repo);
	}
}, 60_000);

test("fixture AC2-no-dup-tag: tip already tagged -> no second tag", () => {
	const repo = initRepo();
	try {
		const sha = commitOnDev(repo.work, "fix: already tagged");
		git(repo.work, ["tag", "-a", "v0.99.0", "-m", "Release v0.99.0", sha]);
		git(repo.work, ["push", "origin", "tag", "v0.99.0"]);
		const prs = path.join(repo.root, "prs.json");
		writePrs(prs, { [sha]: { number: 20, title: "fix: already tagged" } });
		const tagsBefore = git(repo.bare, ["tag", "--list"]);
		const result = runCli(repo.work, prs, sha);
		assertOk(result);
		expect(lines(result.stdout)).toContain(`skip: tip ${sha} is already tagged v0.99.0`);
		expect(devTip(repo.bare)).toBe(sha);
		expect(git(repo.bare, ["tag", "--list"])).toBe(tagsBefore);
	} finally {
		removeRepo(repo);
	}
}, 60_000);

function cloneWork(repo: Repo, name: string): string {
	const dest = path.join(repo.root, name);
	git(repo.root, ["clone", repo.bare, dest]);
	git(dest, ["config", "user.name", "human"]);
	git(dest, ["config", "user.email", "human@example.com"]);
	git(dest, ["config", "commit.gpgsign", "false"]);
	git(dest, ["config", "tag.gpgsign", "false"]);
	return dest;
}

function releaseSources(bare: string): Map<string, string> {
	const bumps = git(bare, ["log", "--first-parent", "--format=%H", "refs/heads/dev"])
		.split("\n")
		.filter(sha => sha.length > 0)
		.filter(sha => git(bare, ["log", "-1", "--format=%s", sha]).startsWith("chore: release version "));
	const sources = new Map<string, string>();
	for (const bump of bumps) {
		const body = git(bare, ["log", "-1", "--format=%b", bump]);
		const source = /^Release-Source:[ \t]*(\S+)/m.exec(body)?.[1];
		const subject = git(bare, ["log", "-1", "--format=%s", bump]);
		expect(source).toBeTruthy();
		sources.set(source ?? "", subject);
	}
	return sources;
}

function assertOrderedRcTags(bare: string, sources: string[]): void {
	const rc1 = git(bare, ["rev-parse", "v0.25.4-rc.1^{commit}"]);
	const rc2 = git(bare, ["rev-parse", "v0.25.4-rc.2^{commit}"]);
	expect(rc1).not.toBe(rc2);
	expect(git(bare, ["rev-parse", `${rc2}^`])).toBe(rc1);
	expect(devTip(bare)).toBe(rc2);
	const released = releaseSources(bare);
	expect([...released.keys()].sort()).toEqual([...sources].sort());
	expect(released.size).toBe(2);
	assertTagCreatedOnce(bare, "v0.25.4-rc.1", rc1);
	assertTagCreatedOnce(bare, "v0.25.4-rc.2", rc2);
	assertFirstParentLinear(bare);
	assertReflogFastForward(bare);
	expect(git(bare, ["tag", "--list", "v*-rc.*"]).split("\n").filter(Boolean).sort()).toEqual([
		"v0.25.4-rc.1",
		"v0.25.4-rc.2",
	]);
}

test(
	"fixture AC2-race: two near-simultaneous merges -> two distinct ordered rc tags, no overwritten tag, linear bump commits",
	() => {
		const sequential = initRepo();
		try {
			const commitA = commitOnDev(sequential.work, "fix: merge A");
			const commitB = commitOnDev(sequential.work, "fix: merge B");
			const prs = path.join(sequential.root, "prs.json");
			writePrs(prs, {
				[commitA]: { number: 1, title: "fix: merge A" },
				[commitB]: { number: 2, title: "fix: merge B" },
			});
			assertOk(runCli(sequential.work, prs, commitA));
			assertOk(runCli(sequential.work, prs, commitB));
			assertOrderedRcTags(sequential.bare, [commitA, commitB]);
			expect(git(sequential.bare, ["log", "-1", "--format=%s", "v0.25.4-rc.1"])).toBe(
				"chore: release version 0.25.4-rc.1",
			);
			expect(git(sequential.bare, ["rev-parse", "v0.25.4-rc.1^{commit}^"])).toBe(commitB);
		} finally {
			removeRepo(sequential);
		}

		const interleaved = initRepo();
		try {
			const commitA = commitOnDev(interleaved.work, "fix: merge A");
			const commitB = commitOnDev(interleaved.work, "fix: merge B");
			const prs = path.join(interleaved.root, "prs.json");
			writePrs(prs, {
				[commitA]: { number: 1, title: "fix: merge A" },
				[commitB]: { number: 2, title: "fix: merge B" },
			});
			const cloneA = cloneWork(interleaved, "clone-a");
			const cloneB = cloneWork(interleaved, "clone-b");
			const hook = path.join(interleaved.root, "interleave.sh");
			fs.writeFileSync(
				hook,
				[
					"#!/bin/sh",
					"set -eu",
					"unset RELEASE_AUTOBUMP_TEST_BEFORE_PUSH",
					`cd ${JSON.stringify(cloneB)}`,
					[
						"bun run scripts/release-autobump.ts run",
						"--remote origin",
						"--branch dev",
						`--bot-name ${JSON.stringify(BOT_NAME)}`,
						`--bot-email ${JSON.stringify(BOT_EMAIL)}`,
						`--event-sha ${commitB}`,
						`--prs-json ${JSON.stringify(prs)}`,
					].join(" "),
					"",
				].join("\n"),
				{ mode: 0o755 },
			);
			const result = runCli(cloneA, prs, commitA, { RELEASE_AUTOBUMP_TEST_BEFORE_PUSH: hook });
			assertOk(result);
			assertOrderedRcTags(interleaved.bare, [commitA, commitB]);
			expect(lines(result.stdout).filter(line => line.startsWith("Read tip of dev:")).length).toBe(2);
		} finally {
			removeRepo(interleaved);
		}
	},
	120_000,
);

test(
	"fixture AC2-push-rejected-retry: remote tip moves between read and push -> retry on new tip, no force push",
	() => {
		const repo = initRepo();
		try {
			const commitA = commitOnDev(repo.work, "fix: merge A");
			const prs = path.join(repo.root, "prs.json");
			writePrs(prs, { [commitA]: { number: 7, title: "fix: merge A" } });
			const other = cloneWork(repo, "other");
			const marker = path.join(repo.root, "hook-runs");
			const hook = path.join(repo.root, "before-push.sh");
			fs.writeFileSync(
				hook,
				[
					"#!/bin/sh",
					"set -eu",
					`printf 'x\\n' >> ${JSON.stringify(marker)}`,
					`printf '%s\\n' 'fix: landed while the bump was in flight' >> ${JSON.stringify(path.join(other, "notes.txt"))}`,
					`git -C ${JSON.stringify(other)} add notes.txt`,
					`git -C ${JSON.stringify(other)} commit -m 'fix: landed while the bump was in flight'`,
					`git -C ${JSON.stringify(other)} push origin HEAD:refs/heads/dev`,
					"",
				].join("\n"),
				{ mode: 0o755 },
			);
			const result = runCli(repo.work, prs, commitA, { RELEASE_AUTOBUMP_TEST_BEFORE_PUSH: hook });
			assertOk(result);
			const hookCommit = git(other, ["rev-parse", "HEAD"]);
			const bump = devTip(repo.bare);
			const reads = lines(result.stdout).filter(line => line.startsWith("Read tip of dev:"));
			expect(reads).toEqual([`Read tip of dev: ${commitA}`, `Read tip of dev: ${hookCommit}`]);
			expect(lines(result.stdout)).toContain(`released v0.25.4-rc.1 at ${bump} for ${commitA} (#7)`);
			expect(git(repo.bare, ["rev-parse", `${bump}^`])).toBe(hookCommit);
			expect(git(repo.bare, ["rev-parse", `${hookCommit}^`])).toBe(commitA);
			expect(git(repo.bare, ["log", "-1", "--format=%s", bump])).toBe("chore: release version 0.25.4-rc.1");
			expect(fs.readFileSync(marker, "utf8")).toBe("x\n");
			expect(git(repo.bare, ["tag", "--list", "v*-rc.*"])).toBe("v0.25.4-rc.1");
			assertTagCreatedOnce(repo.bare, "v0.25.4-rc.1", bump);
			assertFirstParentLinear(repo.bare);
			assertReflogFastForward(repo.bare);
		} finally {
			removeRepo(repo);
		}
	},
	60_000,
);
