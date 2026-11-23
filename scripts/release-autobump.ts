import fs from "node:fs";
import path from "node:path";

export type ReleaseLevel = "patch" | "minor" | "major";

const LEVEL_RANK: Record<ReleaseLevel, number> = {
	patch: 0,
	minor: 1,
	major: 2,
};

const RELEASE_VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.([1-9]\d*))?$/;
const CONVENTIONAL_SUBJECT = /^([a-zA-Z]+)(?:\([^)]*\))?(!)?:/;

interface ParsedVersion {
	major: number;
	minor: number;
	patch: number;
	rc: number | null;
	core: string;
}

function higherLevel(left: ReleaseLevel, right: ReleaseLevel): ReleaseLevel {
	return LEVEL_RANK[left] >= LEVEL_RANK[right] ? left : right;
}

function hasBreakingFooter(message: string): boolean {
	return message.split(/\r?\n/).some(line => line.startsWith("BREAKING CHANGE:") || line.startsWith("BREAKING-CHANGE:"));
}

/** Commit text contributes a level, or null when it is not a conventional bump signal. */
function levelFromMessage(message: string): ReleaseLevel | null {
	const subject = message.split(/\r?\n/, 1)[0] ?? "";
	const match = CONVENTIONAL_SUBJECT.exec(subject);
	if (match?.[2] === "!" || hasBreakingFooter(message)) return "major";
	if (!match) return null;
	const type = match[1];
	if (type === "feat") return "minor";
	if (type === "fix" || type === "perf" || type === "revert") return "patch";
	return null;
}

function levelFromLabel(label: string): ReleaseLevel | null {
	if (label === "release:patch") return "patch";
	if (label === "release:minor") return "minor";
	if (label === "release:major") return "major";
	return null;
}

/**
 * Highest of the conventional-commit level and any release:* label.
 * feat -> minor, fix/perf/revert -> patch, BREAKING CHANGE or type!: -> major.
 * No matching commit and no release label -> patch.
 */
export function levelFromCommits(messages: string[], labels: string[]): ReleaseLevel {
	let level: ReleaseLevel = "patch";
	for (const message of messages) {
		const fromMessage = levelFromMessage(message);
		if (fromMessage) level = higherLevel(level, fromMessage);
	}
	for (const label of labels) {
		const fromLabel = levelFromLabel(label.trim());
		if (fromLabel) level = higherLevel(level, fromLabel);
	}
	return level;
}

function parseReleaseVersion(version: string): ParsedVersion {
	const stripped = version.trim().replace(/^v/, "");
	const match = RELEASE_VERSION_PATTERN.exec(stripped);
	if (!match) {
		throw new Error(
			`Invalid version: ${version}. Expected x.y.z or x.y.z-rc.N (N is a positive integer with no leading zeros).`,
		);
	}
	const major = Number(match[1]);
	const minor = Number(match[2]);
	const patch = Number(match[3]);
	const rc = match[4] ? Number(match[4]) : null;
	return { major, minor, patch, rc, core: `${major}.${minor}.${patch}` };
}

function compareCore(left: ParsedVersion, right: ParsedVersion): number {
	if (left.major !== right.major) return left.major - right.major;
	if (left.minor !== right.minor) return left.minor - right.minor;
	return left.patch - right.patch;
}

function bumpStableCore(stable: ParsedVersion, level: ReleaseLevel): string {
	switch (level) {
		case "major":
			return `${stable.major + 1}.0.0`;
		case "minor":
			return `${stable.major}.${stable.minor + 1}.0`;
		case "patch":
			return `${stable.major}.${stable.minor}.${stable.patch + 1}`;
	}
}

/**
 * core = bump(lastStable, level).
 * Current `core-rc.N` becomes `core-rc.(N+1)`; otherwise `core-rc.1`.
 * If the current rc core is already ahead of that core, keep it and increment N.
 */
export function nextRcVersion(input: { current: string; lastStable: string; level: ReleaseLevel }): string {
	const current = parseReleaseVersion(input.current);
	const lastStable = parseReleaseVersion(input.lastStable);
	const core = bumpStableCore(lastStable, input.level);
	const coreVersion = parseReleaseVersion(core);
	if (current.rc !== null && compareCore(current, coreVersion) >= 0) {
		return `${current.core}-rc.${current.rc + 1}`;
	}
	if (current.rc === null && compareCore(current, coreVersion) > 0) {
		return `${current.core}-rc.1`;
	}
	return `${core}-rc.1`;
}

function hasReleaseSourceTrailer(body: string): boolean {
	return /^Release-Source:[ \t]*\S+/m.test(body);
}

/** True for a bump commit authored by the release bot or carrying a Release-Source trailer. */
export function isReleaseBumpCommit(
	commit: { subject: string; authorName: string; body: string },
	botLogin: string,
): boolean {
	if (!commit.subject.startsWith("chore: release version ")) return false;
	const authorIsBot = botLogin.length > 0 && commit.authorName === botLogin;
	return authorIsBot || hasReleaseSourceTrailer(commit.body);
}

const repoRoot = path.resolve(import.meta.dir, "..");
const MAX_PUSH_ATTEMPTS = 5;

interface CliOptions {
	dryRun: boolean;
	remote: string;
	branch: string;
	botName: string;
	botEmail: string;
	eventSha: string | null;
	prsJson: string | null;
}

interface PrInfo {
	number: number;
	base: string;
	merged: boolean;
	labels: string[];
	title: string;
	mergeCommitSha?: string;
}

interface CommitView {
	sha: string;
	subject: string;
	authorName: string;
	body: string;
	full: string;
}

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}

function usage(): never {
	console.error(
		"Usage: bun run scripts/release-autobump.ts run [--dry-run] [--remote origin] [--branch dev] [--bot-name NAME] [--bot-email EMAIL] [--event-sha SHA] [--prs-json FILE]",
	);
	process.exit(1);
}

function decode(value: unknown): string {
	if (typeof value === "string") return value;
	if (value instanceof Uint8Array) return new TextDecoder().decode(value);
	return "";
}

function git(args: string[], env?: Record<string, string>): { code: number; stdout: string; stderr: string } {
	const result = Bun.spawnSync(["git", ...args], {
		cwd: repoRoot,
		env: env ?? process.env,
		stdout: "pipe",
		stderr: "pipe",
	});
	return {
		code: result.exitCode ?? 1,
		stdout: decode(result.stdout).trimEnd(),
		stderr: decode(result.stderr).trimEnd(),
	};
}

function gitOk(args: string[], env?: Record<string, string>): string {
	const result = git(args, env);
	if (result.code !== 0) {
		fail(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
	}
	return result.stdout;
}

function requireValue(argv: string[], index: number): string {
	const value = argv[index];
	if (!value || value.startsWith("--")) usage();
	return value;
}

function parseArgs(argv: string[]): CliOptions {
	if (argv[0] !== "run") usage();
	const opts: CliOptions = {
		dryRun: false,
		remote: "origin",
		branch: "dev",
		botName: "",
		botEmail: "",
		eventSha: null,
		prsJson: null,
	};
	for (let i = 1; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--dry-run") {
			opts.dryRun = true;
			continue;
		}
		if (arg === "--remote") {
			opts.remote = requireValue(argv, ++i);
			continue;
		}
		if (arg === "--branch") {
			opts.branch = requireValue(argv, ++i);
			continue;
		}
		if (arg === "--bot-name") {
			opts.botName = requireValue(argv, ++i);
			continue;
		}
		if (arg === "--bot-email") {
			opts.botEmail = requireValue(argv, ++i);
			continue;
		}
		if (arg === "--event-sha") {
			opts.eventSha = requireValue(argv, ++i);
			continue;
		}
		if (arg === "--prs-json") {
			opts.prsJson = requireValue(argv, ++i);
			continue;
		}
		usage();
	}
	return opts;
}

function baseRef(base: unknown): string {
	if (typeof base === "string") return base.replace(/^refs\/heads\//, "");
	if (base && typeof base === "object" && typeof (base as { ref?: unknown }).ref === "string") {
		return (base as { ref: string }).ref.replace(/^refs\/heads\//, "");
	}
	return "";
}

function normalizeLabels(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const labels: string[] = [];
	for (const entry of value) {
		if (typeof entry === "string") labels.push(entry);
		else if (entry && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string") {
			labels.push((entry as { name: string }).name);
		}
	}
	return labels;
}

function normalizePr(value: unknown): PrInfo | null {
	if (!value || typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	if (typeof record.number !== "number" || typeof record.title !== "string" || typeof record.merged !== "boolean") {
		return null;
	}
	const mergeCommitSha = typeof record.merge_commit_sha === "string" ? record.merge_commit_sha : undefined;
	return {
		number: record.number,
		base: baseRef(record.base),
		merged: record.merged,
		labels: normalizeLabels(record.labels),
		title: record.title,
		mergeCommitSha,
	};
}

function loadPrMap(file: string | null): Map<string, PrInfo> {
	if (!file) return new Map();
	let raw: string;
	try {
		raw = fs.readFileSync(file, "utf8");
	} catch (error) {
		fail(`Failed to read ${file}: ${error instanceof Error ? error.message : String(error)}`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		fail(`Failed to parse ${file}: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		fail(`PR map ${file} must be a JSON object of sha -> pull request.`);
	}
	const map = new Map<string, PrInfo>();
	for (const [sha, value] of Object.entries(parsed)) {
		const pr = normalizePr(value);
		if (!pr) continue;
		const resolved = git(["rev-parse", "--verify", `${sha}^{commit}`]);
		map.set(resolved.code === 0 ? resolved.stdout : sha, pr);
	}
	return map;
}

function botEnv(botName: string, botEmail: string): Record<string, string> {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (typeof value === "string") env[key] = value;
	}
	env.GIT_AUTHOR_NAME = botName;
	env.GIT_AUTHOR_EMAIL = botEmail;
	env.GIT_COMMITTER_NAME = botName;
	env.GIT_COMMITTER_EMAIL = botEmail;
	return env;
}

function loadCommit(sha: string): CommitView {
	return {
		sha,
		subject: gitOk(["log", "-1", "--format=%s", sha]),
		authorName: gitOk(["log", "-1", "--format=%an", sha]),
		body: gitOk(["log", "-1", "--format=%b", sha]),
		full: gitOk(["log", "-1", "--format=%B", sha]),
	};
}

function tagsAt(sha: string): string[] {
	const result = git(["tag", "--points-at", sha, "--list", "v*"]);
	if (result.code !== 0) fail(`git tag --points-at ${sha} failed: ${result.stderr}`);
	if (!result.stdout) return [];
	return result.stdout.split("\n").filter(tag => tag.length > 0);
}

function releaseSource(body: string): string | null {
	const match = /^Release-Source:[ \t]*(\S+)/m.exec(body);
	return match?.[1] ?? null;
}

function releaseTagName(commit: CommitView): string {
	const tags = tagsAt(commit.sha);
	const versionTag = tags.find(tag => /^v\d+\.\d+\.\d+/.test(tag));
	if (versionTag) return versionTag;
	const subject = /^chore: release version (\S+)/.exec(commit.subject);
	if (subject?.[1]) return `v${subject[1]}`;
	return tags[0] ?? "unknown";
}

function readRootVersion(): string {
	const packagePath = path.join(repoRoot, "package.json");
	let parsed: unknown;
	try {
		parsed = JSON.parse(fs.readFileSync(packagePath, "utf8"));
	} catch (error) {
		fail(`Failed to read root package.json: ${error instanceof Error ? error.message : String(error)}`);
	}
	const version = (parsed as { version?: unknown }).version;
	if (typeof version !== "string") fail("Root package.json is missing a string version.");
	return version;
}

function sameCommit(recorded: string, sha: string): boolean {
	if (recorded === sha) return true;
	const resolved = git(["rev-parse", "--verify", `${recorded}^{commit}`]);
	return resolved.code === 0 && resolved.stdout === sha;
}

function qualifies(sha: string, pr: PrInfo | undefined, branch: string): pr is PrInfo {
	if (!pr || !pr.merged || pr.base !== branch) return false;
	if (pr.mergeCommitSha && !sameCommit(pr.mergeCommitSha, sha)) return false;
	return true;
}

function fetchTip(remote: string, branch: string): string {
	const fetched = git(["fetch", remote, branch, "--tags", "--force"]);
	if (fetched.code !== 0) {
		fail(`git fetch ${remote} ${branch} --tags --force failed: ${fetched.stderr || fetched.stdout}`);
	}
	const tip = git(["rev-parse", "--verify", `${remote}/${branch}`]);
	if (tip.code !== 0) {
		fail(`failed to resolve ${remote}/${branch}: ${tip.stderr || tip.stdout}`);
	}
	return tip.stdout;
}

function syncBranchToTip(branch: string, tip: string): void {
	const head = git(["symbolic-ref", "--short", "HEAD"]);
	if (head.code !== 0 || head.stdout !== branch) {
		const switched = git(["checkout", branch]);
		if (switched.code !== 0) {
			const created = git(["checkout", "-B", branch, tip]);
			if (created.code !== 0) fail(`failed to check out ${branch}: ${created.stderr || created.stdout}`);
		}
	}
	const reset = git(["reset", "--hard", tip]);
	if (reset.code !== 0) fail(`failed to reset to ${tip}: ${reset.stderr || reset.stdout}`);
}

function isBump(commit: CommitView, botName: string): boolean {
	return isReleaseBumpCommit(
		{ subject: commit.subject, authorName: commit.authorName, body: commit.body },
		botName,
	);
}

function selectCandidates(
	commits: CommitView[],
	eventSha: string,
	tip: string,
	botName: string,
	branch: string,
): string[] {
	let lastBumpIndex = -1;
	for (let i = 0; i < commits.length; i++) {
		const commit = commits[i];
		if (commit && isBump(commit, botName)) lastBumpIndex = i;
	}
	if (lastBumpIndex === -1) {
		const eventIndex = commits.findIndex(commit => commit.sha === eventSha);
		if (eventIndex === -1) {
			fail(`event ${eventSha} is not on the first-parent history of ${branch}`);
		}
		// No bump since the stable tag. `commits` is the first-parent range
		// through the tip read on this attempt (including a push-rejected retry),
		// oldest first. The PR map still drops anything that is not a merged PR.
		return commits.slice(eventIndex).map(commit => commit.sha);
	}
	const after = commits.slice(lastBumpIndex + 1).map(commit => commit.sha);
	if (eventSha === tip || after.includes(eventSha)) return after;
	const event = commits.find(commit => commit.sha === eventSha);
	if (!event) fail(`event ${eventSha} is not on the first-parent history of ${branch}`);
	if (isBump(event, botName)) return after;
	// The event merge landed before a bump that released a different sha.
	return commits.filter(commit => commit.sha === eventSha || after.includes(commit.sha)).map(commit => commit.sha);
}

function levelInputs(
	commits: CommitView[],
	prs: Map<string, PrInfo>,
	botName: string,
): { messages: string[]; labels: string[] } {
	const messages: string[] = [];
	const shas = new Set<string>();
	for (const commit of commits) {
		if (isBump(commit, botName)) continue;
		messages.push(commit.full);
		shas.add(commit.sha);
	}
	for (const [sha, pr] of prs) {
		if (!shas.has(sha) || !pr.title) continue;
		messages.push(pr.title);
	}
	const labels: string[] = [];
	for (const pr of prs.values()) {
		if (!pr.merged) continue;
		labels.push(...pr.labels);
	}
	return { messages, labels };
}

function indexReleased(commits: CommitView[], botName: string): Map<string, string> {
	const released = new Map<string, string>();
	for (const commit of commits) {
		if (!isBump(commit, botName)) continue;
		const source = releaseSource(commit.body);
		if (!source) continue;
		const resolved = git(["rev-parse", "--verify", `${source}^{commit}`]);
		released.set(resolved.code === 0 ? resolved.stdout : source, releaseTagName(commit));
	}
	return released;
}

function runBump(version: string): void {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (typeof value === "string" && key !== "RELEASE_BUMP_ROOT") env[key] = value;
	}
	const result = Bun.spawnSync([process.execPath, "run", "scripts/bump-release-version.ts", version], {
		cwd: repoRoot,
		env,
		stdout: "pipe",
		stderr: "pipe",
	});
	if ((result.exitCode ?? 1) !== 0) {
		fail(`bump to ${version} failed: ${decode(result.stderr) || decode(result.stdout)}`);
	}
}

function commitRelease(version: string, source: string, prNumber: number, botName: string, botEmail: string): void {
	const added = git(["add", "-u"]);
	if (added.code !== 0) fail(`git add failed: ${added.stderr || added.stdout}`);
	const subject = `chore: release version ${version}`;
	const body = `Release-Source: ${source}\nRelease-PR: #${prNumber}`;
	const env = botEnv(botName, botEmail);
	const committed = git(
		["-c", `user.name=${botName}`, "-c", `user.email=${botEmail}`, "commit", "-m", subject, "-m", body],
		env,
	);
	if (committed.code !== 0) fail(`git commit failed: ${committed.stderr || committed.stdout}`);
}

function createTag(tag: string, botName: string, botEmail: string): void {
	const created = git(
		["-c", `user.name=${botName}`, "-c", `user.email=${botEmail}`, "tag", "-a", tag, "-m", `Release ${tag}`],
		botEnv(botName, botEmail),
	);
	if (created.code !== 0) fail(`git tag ${tag} failed: ${created.stderr || created.stdout}`);
}

function localTagExists(tag: string): boolean {
	return git(["show-ref", "--verify", "--quiet", `refs/tags/${tag}`]).code === 0;
}

function remoteTagExists(remote: string, tag: string): boolean {
	const result = git(["ls-remote", "--tags", remote, `refs/tags/${tag}`]);
	if (result.code !== 0) fail(`git ls-remote --tags ${remote} failed: ${result.stderr || result.stdout}`);
	return result.stdout.split("\n").some(line => line.endsWith(`refs/tags/${tag}`) || line.endsWith(`refs/tags/${tag}^{}`));
}

/** Tests set this to a shell script. It runs once, before the first push only. */
let testBeforePushRan = false;

function runTestBeforePushHook(): void {
	if (testBeforePushRan) return;
	const hook = process.env.RELEASE_AUTOBUMP_TEST_BEFORE_PUSH;
	if (!hook) return;
	testBeforePushRan = true;
	const hookPath = path.isAbsolute(hook) ? hook : path.resolve(repoRoot, hook);
	const result = Bun.spawnSync(["sh", hookPath], {
		cwd: repoRoot,
		env: process.env,
		stdout: "pipe",
		stderr: "pipe",
	});
	if ((result.exitCode ?? 1) !== 0) {
		fail(`RELEASE_AUTOBUMP_TEST_BEFORE_PUSH failed: ${decode(result.stderr) || decode(result.stdout)}`);
	}
}

function pushRelease(
	remote: string,
	branch: string,
	tag: string,
): { ok: true } | { ok: false; moved: boolean; output: string } {
	// Read the tip before the test hook. The hook is what moves the remote
	// between this read and the push.
	const before = git(["rev-parse", "--verify", `${remote}/${branch}`]);
	if (before.code !== 0) fail(`failed to resolve ${remote}/${branch}: ${before.stderr || before.stdout}`);
	runTestBeforePushHook();
	const pushed = git(["push", "--atomic", remote, `HEAD:refs/heads/${branch}`, `refs/tags/${tag}`]);
	if (pushed.code === 0) return { ok: true };
	const output = pushed.stderr || pushed.stdout;
	let moved = false;
	const fetched = git(["fetch", remote, branch, "--tags", "--force"]);
	if (fetched.code === 0) {
		const after = git(["rev-parse", "--verify", `${remote}/${branch}`]);
		moved = after.code === 0 && after.stdout !== before.stdout;
	}
	return { ok: false, moved, output };
}

function releaseCandidate(
	opts: CliOptions,
	sha: string,
	pr: PrInfo,
	lastStableTag: string,
	level: ReleaseLevel,
): "ok" | "retry" {
	if (!opts.botName || !opts.botEmail) {
		fail("bot name and email are required to create a release commit (--bot-name, --bot-email)");
	}
	let version: string;
	try {
		version = nextRcVersion({ current: readRootVersion(), lastStable: lastStableTag, level });
	} catch (error) {
		fail(error instanceof Error ? error.message : String(error));
	}
	if (!/^(\d+)\.(\d+)\.(\d+)-rc\.([1-9]\d*)$/.test(version)) {
		fail(`refusing to release invalid version ${version}`);
	}
	const tag = `v${version}`;
	if (localTagExists(tag) || remoteTagExists(opts.remote, tag)) {
		fail(`refusing to overwrite existing tag ${tag}`);
	}
	runBump(version);
	commitRelease(version, sha, pr.number, opts.botName, opts.botEmail);
	createTag(tag, opts.botName, opts.botEmail);
	const commitSha = gitOk(["rev-parse", "HEAD"]);
	if (opts.dryRun) {
		console.log(`planned version ${version} tag ${tag}`);
		console.log(`released ${tag} at ${commitSha} for ${sha} (#${pr.number})`);
		return "ok";
	}
	const pushed = pushRelease(opts.remote, opts.branch, tag);
	if (!pushed.ok) {
		if (pushed.moved) {
			git(["tag", "-d", tag]);
			const tip = fetchTip(opts.remote, opts.branch);
			const reset = git(["reset", "--hard", tip]);
			if (reset.code !== 0) fail(`failed to reset to ${tip}: ${reset.stderr || reset.stdout}`);
			return "retry";
		}
		fail(`failed to push ${tag}: ${pushed.output}`);
	}
	console.log(`released ${tag} at ${commitSha} for ${sha} (#${pr.number})`);
	return "ok";
}

function runAttempt(opts: CliOptions): "done" | "retry" {
	const tip = fetchTip(opts.remote, opts.branch);
	console.log(`Read tip of dev: ${tip}`);
	const eventSha = opts.eventSha ? gitOk(["rev-parse", "--verify", `${opts.eventSha}^{commit}`]) : tip;
	const tipCommit = loadCommit(tip);
	const tipIsBump = isBump(tipCommit, opts.botName);
	if (tipIsBump && eventSha === tip) {
		console.log(`skip: tip ${tip} is a release bump commit; nothing to do`);
		return "done";
	}
	const tipTags = tagsAt(tip);
	const tipTag = tipTags[0];
	if (tipTag && eventSha === tip) {
		console.log(`skip: tip ${tip} is already tagged ${tipTag}`);
		return "done";
	}

	const described = git(["describe", "--tags", "--abbrev=0", "--match", "v*", "--exclude", "v*-*", tip]);
	if (described.code !== 0) fail(`no stable tag reachable from ${tip}`);
	const lastStableTag = described.stdout.trim();
	const listed = git(["rev-list", "--first-parent", "--reverse", `${lastStableTag}..${tip}`]);
	if (listed.code !== 0) fail(`git rev-list failed: ${listed.stderr || listed.stdout}`);
	const shas = listed.stdout ? listed.stdout.split("\n").filter(sha => sha.length > 0) : [];
	const commits = shas.map(loadCommit);
	if (commits.length === 0) {
		console.log(`skip: ${eventSha} is not a merged pull request into dev`);
		return "done";
	}

	const candidates = selectCandidates(commits, eventSha, tip, opts.botName, opts.branch);
	if (candidates.length === 0 && tipIsBump) {
		console.log(`skip: tip ${tip} is a release bump commit; nothing to do`);
		return "done";
	}

	const prs = loadPrMap(opts.prsJson);
	const released = indexReleased(commits, opts.botName);
	const { messages, labels } = levelInputs(commits, prs, opts.botName);
	const level = levelFromCommits(messages, labels);

	let synced = false;
	for (const sha of candidates) {
		const pr = prs.get(sha);
		if (!qualifies(sha, pr, opts.branch)) {
			console.log(`skip: ${sha} is not a merged pull request into dev`);
			continue;
		}
		const existing = released.get(sha);
		if (existing) {
			console.log(`skip: ${sha} already released as ${existing}`);
			continue;
		}
		if (!synced) {
			syncBranchToTip(opts.branch, tip);
			synced = true;
		}
		const outcome = releaseCandidate(opts, sha, pr, lastStableTag, level);
		if (outcome === "retry") return "retry";
	}
	return "done";
}

function runCli(opts: CliOptions): void {
	for (let attempt = 1; attempt <= MAX_PUSH_ATTEMPTS; attempt++) {
		const outcome = runAttempt(opts);
		if (outcome === "done") return;
		if (attempt === MAX_PUSH_ATTEMPTS) {
			fail(
				`failed to push after ${MAX_PUSH_ATTEMPTS} attempts because ${opts.remote}/${opts.branch} moved`,
			);
		}
	}
}

if (import.meta.main) {
	runCli(parseArgs(process.argv.slice(2)));
}
