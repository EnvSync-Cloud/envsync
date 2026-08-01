/**
 * H1.4–H1.5 Hosted cutover checks.
 *
 * Always: repo invariants (deploy-fe edition, SDK paths, support docs).
 * Optional live smoke when HOSTED_SMOKE_BASE_URL (+ token) is set.
 *
 * Usage:
 *   bun run scripts/hosted-cutover-check.ts
 *   HOSTED_SMOKE_BASE_URL=https://api.staging... HOSTED_SMOKE_TOKEN=... bun run scripts/hosted-cutover-check.ts
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
let failed = 0;

function fail(msg: string) {
	console.error(`✗ ${msg}`);
	failed++;
}

function ok(msg: string) {
	console.log(`✓ ${msg}`);
}

function read(rel: string) {
	return fs.readFileSync(path.join(root, rel), "utf8");
}

console.log("Hosted cutover checklist (repo invariants)\n");

// deploy-fe
const deployFe = read(".github/workflows/deploy-fe.yaml");
if (/bun run --filter envsync-web build:oss/.test(deployFe)) {
	fail("deploy-fe must not build Hosted web with build:oss");
} else if (!/build:hosted|build:enterprise/.test(deployFe)) {
	fail("deploy-fe must use build:hosted or build:enterprise");
} else {
	ok("deploy-fe uses enterprise/hosted web build");
}
if (!deployFe.includes("envsync-enterprise-web")) {
	fail("deploy-fe path filters should include envsync-enterprise-web");
} else {
	ok("deploy-fe watches envsync-enterprise-web");
}

// release still oss for self-host
const release = read(".github/workflows/release.yml");
if (!release.includes("build:oss") && !release.includes("build_script: build:oss")) {
	// soft — release may encode differently
	console.warn("! release.yml: could not confirm build:oss path for OSS images (manual check)");
} else {
	ok("release.yml still references build:oss for self-host OSS images");
}

// SDK paths
const tsAuth = read("sdks/envsync-ts-sdk/src/services/AuthenticationService.ts");
if (tsAuth.includes("/api/auth/create-workspace")) {
	fail("TS SDK still references create-workspace URL");
} else if (!tsAuth.includes("/api/auth/create-organization")) {
	fail("TS SDK missing create-organization path");
} else {
	ok("TS SDK create-organization path");
}

const goAuth = read("sdks/envsync-go-sdk/sdk/authentication/client.go");
if (goAuth.includes("/api/auth/create-workspace")) {
	fail("Go SDK still references create-workspace URL");
} else if (!goAuth.includes("/api/auth/create-organization")) {
	fail("Go SDK missing create-organization path");
} else {
	ok("Go SDK create-organization path");
}

// web package: EE as devDep
const webPkg = JSON.parse(read("apps/envsync-web/package.json")) as {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	scripts?: Record<string, string>;
};
if (webPkg.dependencies?.["envsync-enterprise-web"]) {
	fail("envsync-web must not production-depend on envsync-enterprise-web");
} else if (!webPkg.devDependencies?.["envsync-enterprise-web"]) {
	fail("envsync-web missing envsync-enterprise-web devDependency");
} else {
	ok("envsync-web enterprise-web is devDependency");
}
if (!webPkg.scripts?.["build:hosted"]?.includes("enterprise")) {
	fail("envsync-web build:hosted should set enterprise Vite license");
} else {
	ok("envsync-web build:hosted present");
}

// docs
if (!fs.existsSync(path.join(root, "docs/HOSTED-CUTOVER.md"))) {
	fail("docs/HOSTED-CUTOVER.md missing");
} else {
	ok("docs/HOSTED-CUTOVER.md present");
}
const support = read("docs/SUPPORT.md");
if (!support.includes("build:hosted")) {
	fail("SUPPORT.md should document Hosted build:hosted");
} else {
	ok("SUPPORT.md documents Hosted FE build");
}

// optional live smoke
const base = process.env.HOSTED_SMOKE_BASE_URL?.replace(/\/$/, "");
const token = process.env.HOSTED_SMOKE_TOKEN;

if (base) {
	console.log("\nLive Hosted smoke\n");
	const headers: Record<string, string> = {
		Accept: "application/json",
	};
	if (token) {
		headers.Authorization = `Bearer ${token}`;
		headers.Cookie = token.includes("=") ? token : `session=${token}`;
	}

	try {
		const health = await fetch(`${base}/health`).catch(() =>
			fetch(`${base}/api/health`).catch(() => null),
		);
		if (health && health.ok) {
			ok(`health reachable (${health.status})`);
		} else if (health) {
			console.warn(`! health returned ${health.status} (may be expected path)`);
		} else {
			fail(`could not reach ${base} health endpoints`);
		}

		if (token) {
			const createOrg = await fetch(`${base}/api/auth/create-organization`, {
				method: "POST",
				headers: {
					...headers,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: `cutover-smoke-${Date.now()}`,
					slug: `cutover-smoke-${Date.now()}`,
				}),
			});
			if (createOrg.status === 200 || createOrg.status === 201) {
				ok(`create-organization → ${createOrg.status}`);
			} else if (createOrg.status === 401 || createOrg.status === 403) {
				fail(
					`create-organization → ${createOrg.status} (auth/policy). Check HOSTED_SMOKE_TOKEN + DEPLOYMENT_MODE=hosted`,
				);
			} else {
				const body = await createOrg.text().catch(() => "");
				fail(`create-organization → ${createOrg.status} ${body.slice(0, 200)}`);
			}

			// Removed route should not exist
			const legacy = await fetch(`${base}/api/auth/create-workspace`, {
				method: "POST",
				headers: {
					...headers,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name: "should-404" }),
			});
			if (legacy.status === 404 || legacy.status === 405) {
				ok(`create-workspace removed (${legacy.status})`);
			} else {
				fail(`create-workspace still reachable: ${legacy.status}`);
			}
		} else {
			console.warn("! HOSTED_SMOKE_TOKEN unset — skipped authenticated API smoke");
		}
	} catch (e) {
		fail(`live smoke error: ${e instanceof Error ? e.message : String(e)}`);
	}
} else {
	console.log("\n(skip live smoke — set HOSTED_SMOKE_BASE_URL to exercise staging API)");
}

console.log("");
if (failed > 0) {
	console.error(`Hosted cutover check failed (${failed} issue(s)).`);
	console.error("See docs/HOSTED-CUTOVER.md");
	process.exit(1);
}
console.log("Hosted cutover check passed.");
