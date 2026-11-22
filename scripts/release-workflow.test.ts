import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "bun:test";

const root = path.resolve(import.meta.dir, "..");
const releasePath = path.join(root, ".github/workflows/release.yml");
const goreleaserPath = path.join(root, "packages/envsync-cli/.goreleaser.yml");

type Step = {
	id?: string;
	uses?: string;
	run?: string;
	env?: Record<string, string>;
	with?: Record<string, string>;
};

type Job = {
	name?: string;
	needs?: string | string[];
	if?: string;
	env?: Record<string, string>;
	outputs?: Record<string, string>;
	steps?: Step[];
};

type Workflow = {
	on?: { push?: { tags?: string[] } };
	jobs: Record<string, Job>;
};

type GoreleaserConfig = {
	release?: {
		prerelease?: string | boolean;
		make_latest?: string | boolean;
	};
};

const releaseText = readFileSync(releasePath, "utf8");
const workflow = Bun.YAML.parse(releaseText) as Workflow;
const enableGuard = "enable=${{ needs.release-meta.outputs.is_prerelease != 'true' }}";

function needsList(needs: Job["needs"]): string[] {
	if (Array.isArray(needs)) {
		return needs;
	}
	if (typeof needs === "string" && needs.length > 0) {
		return [needs];
	}
	return [];
}

function parseGithubOutput(text: string): Record<string, string> {
	const values: Record<string, string> = {};
	for (const line of text.split("\n")) {
		if (line.length === 0) {
			continue;
		}
		const separator = line.indexOf("=");
		if (separator === -1) {
			continue;
		}
		values[line.slice(0, separator)] = line.slice(separator + 1);
	}
	return values;
}

function classify(script: string, refName: string) {
	const dir = mkdtempSync(path.join(tmpdir(), "release-meta-"));
	const outputPath = path.join(dir, "github_output");
	const scriptPath = path.join(dir, "classify.sh");
	writeFileSync(outputPath, "");
	writeFileSync(scriptPath, script);
	try {
		const result = spawnSync("bash", [scriptPath], {
			encoding: "utf8",
			env: {
				...process.env,
				GITHUB_REF_NAME: refName,
				GITHUB_OUTPUT: outputPath,
			},
		});
		return {
			status: result.status,
			stdout: result.stdout ?? "",
			stderr: result.stderr ?? "",
			output: parseGithubOutput(readFileSync(outputPath, "utf8")),
		};
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

test("fixture AC3-meta: rc and stable tags classify correctly", () => {
	expect(workflow.on?.push?.tags).toEqual(["v*.*.*"]);

	const job = workflow.jobs["release-meta"];
	if (!job) {
		throw new Error("release-meta job is missing");
	}
	expect(job.name).toBe("Release metadata");

	const scriptStep = (job.steps ?? []).find(
		(step) => typeof step.run === "string" && step.run.includes("GITHUB_OUTPUT"),
	);
	expect(scriptStep?.run).toBeDefined();
	expect(scriptStep?.id).toBe("meta");
	expect(job.outputs?.version).toBe("${{ steps.meta.outputs.version }}");
	expect(job.outputs?.is_prerelease).toBe("${{ steps.meta.outputs.is_prerelease }}");
	expect(job.outputs?.npm_tag).toBe("${{ steps.meta.outputs.npm_tag }}");

	const script = scriptStep?.run ?? "";
	const rc = classify(script, "v0.25.4-rc.1");
	expect(rc.status).toBe(0);
	expect(rc.output.is_prerelease).toBe("true");
	expect(rc.output.npm_tag).toBe("next");
	expect(rc.output.version).toBe("0.25.4-rc.1");

	const stable = classify(script, "v0.25.4");
	expect(stable.status).toBe(0);
	expect(stable.output.is_prerelease).toBe("false");
	expect(stable.output.npm_tag).toBe("latest");
	expect(stable.output.version).toBe("0.25.4");

	for (const tag of ["v0.25.4-beta.1", "v0.25.4-rc.0", "0.25.4"]) {
		const invalid = classify(script, tag);
		expect(invalid.status).not.toBe(0);
		expect(`${invalid.stderr}${invalid.stdout}`).toContain("vX.Y.Z");
		expect(`${invalid.stderr}${invalid.stdout}`).toContain(tag);
	}

	for (const [jobId, other] of Object.entries(workflow.jobs)) {
		if (jobId === "release-meta") {
			continue;
		}
		expect(needsList(other.needs)).toContain("release-meta");
	}
});

test("fixture AC3-images: latest, stable and major.minor are disabled for rc", () => {
	const metadataSteps: Step[] = [];
	for (const job of Object.values(workflow.jobs)) {
		for (const step of job.steps ?? []) {
			if (typeof step.uses === "string" && step.uses.includes("docker/metadata-action")) {
				metadataSteps.push(step);
			}
		}
	}

	expect(metadataSteps.length).toBeGreaterThan(0);
	for (const step of metadataSteps) {
		expect(String(step.with?.flavor ?? "")).toContain("latest=false");
		const lines = String(step.with?.tags ?? "")
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);

		const majorMinor = lines.find((line) => line.includes("{{major}}.{{minor}}"));
		const stable = lines.find((line) => line.includes("value=stable"));
		const latest = lines.find((line) => line.includes("value=latest"));
		expect(majorMinor).toContain(enableGuard);
		expect(stable).toContain(enableGuard);
		expect(latest).toContain(enableGuard);
		expect(lines.some((line) => line.includes("pattern={{version}}") && !line.includes("enable="))).toBe(true);
		expect(lines.some((line) => line.startsWith("type=sha,prefix=") && !line.includes("enable="))).toBe(true);
	}
});

test("fixture AC3-npm: every npm publish uses the computed dist-tag", () => {
	const commandLines = releaseText
		.split("\n")
		.filter((line) => /\bnpm publish\b/.test(line) && !/^\s*-\s*name:/.test(line));
	expect(commandLines.length).toBeGreaterThan(0);
	for (const line of commandLines) {
		expect(line).toContain("--tag");
	}

	let publishSteps = 0;
	for (const job of Object.values(workflow.jobs)) {
		for (const step of job.steps ?? []) {
			const run = step.run ?? "";
			const publishes = run
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => /(?:^|&&\s*)npm publish\b/.test(line));
			if (publishes.length === 0) {
				continue;
			}
			publishSteps += publishes.length;
			for (const line of publishes) {
				expect(line).toContain("--tag");
				expect(line).toContain('"$NPM_DIST_TAG"');
			}
			const env = { ...(job.env ?? {}), ...(step.env ?? {}) };
			expect(env.NPM_DIST_TAG).toBe("${{ needs.release-meta.outputs.npm_tag }}");
		}
	}
	expect(publishSteps).toBe(commandLines.length);
	expect(publishSteps).toBe(4);
});

test("fixture AC3-prod: deploy-production is skipped for rc tags", () => {
	const job = workflow.jobs["deploy-production"];
	expect(job).toBeDefined();
	expect(job?.if).toBe("needs.release-meta.outputs.is_prerelease != 'true'");
	expect(needsList(job?.needs)).toContain("release-meta");
	expect(needsList(job?.needs)).toEqual([
		"release-meta",
		"goreleaser",
		"build-api-image",
		"build-api-enterprise-image",
		"build-frontend-static-images",
		"publish-oss-deploy",
		"publish-deploy-core",
		"publish-enterprise-deploy-cli",
		"publish-ts-sdk",
	]);
});

test("fixture AC3-goreleaser: CLI release is a prerelease for rc tags", () => {
	const config = Bun.YAML.parse(readFileSync(goreleaserPath, "utf8")) as GoreleaserConfig;
	expect(config.release?.prerelease).toBe("auto");
	expect(config.release?.make_latest).not.toBe(true);
	expect(config.release?.make_latest).not.toBe("true");
});
