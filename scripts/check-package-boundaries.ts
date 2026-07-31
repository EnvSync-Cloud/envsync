/**
 * Phase 5 CI guard: management-api must not piggyback on envsync-api via relative paths;
 * core envsync-api production deps must not include envsync-enterprise.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
let failed = false;

function fail(message: string) {
	console.error(`✗ ${message}`);
	failed = true;
}

function ok(message: string) {
	console.log(`✓ ${message}`);
}

// 1) management-api src: no relative envsync-api imports
const managementSrc = path.join(root, "packages/envsync-management-api/src");
const piggybackRe = /from\s+["']\.\.\/\.\.\/envsync-api\//;
for (const file of fs.readdirSync(managementSrc)) {
	if (!file.endsWith(".ts")) continue;
	const text = fs.readFileSync(path.join(managementSrc, file), "utf8");
	if (piggybackRe.test(text)) {
		fail(`management-api relative import in src/${file}`);
	}
}
ok("management-api has no ../../envsync-api relative imports");

// 2) envsync-api production deps exclude envsync-enterprise
const apiPkg = JSON.parse(
	fs.readFileSync(path.join(root, "packages/envsync-api/package.json"), "utf8"),
) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
if (apiPkg.dependencies?.["envsync-enterprise"]) {
	fail("envsync-api production dependencies must not include envsync-enterprise");
} else {
	ok("envsync-api production deps exclude envsync-enterprise");
}

// 3) management-api depends on enterprise package
const mgmtPkg = JSON.parse(
	fs.readFileSync(path.join(root, "packages/envsync-management-api/package.json"), "utf8"),
) as { dependencies?: Record<string, string> };
if (!mgmtPkg.dependencies?.["envsync-enterprise"]) {
	fail("envsync-management-api must depend on envsync-enterprise");
} else {
	ok("envsync-management-api depends on envsync-enterprise");
}

// 4) enterprise package has proprietary LICENSE
const entLicense = path.join(root, "packages/envsync-enterprise/LICENSE");
if (!fs.existsSync(entLicense)) {
	fail("envsync-enterprise/LICENSE missing");
} else {
	const text = fs.readFileSync(entLicense, "utf8");
	if (!/proprietary|Enterprise License/i.test(text)) {
		fail("envsync-enterprise/LICENSE does not look proprietary");
	} else {
		ok("envsync-enterprise has proprietary LICENSE");
	}
}

// 5) kernel is MIT-named package present
if (!fs.existsSync(path.join(root, "packages/envsync-kernel/package.json"))) {
	fail("envsync-kernel package missing");
} else {
	ok("envsync-kernel package present");
}

// 6) Phase 5b: enterprise-web package present; shell no longer owns integration pages
const eeWeb = path.join(root, "packages/envsync-enterprise-web");
if (!fs.existsSync(path.join(eeWeb, "package.json"))) {
	fail("envsync-enterprise-web package missing");
} else {
	ok("envsync-enterprise-web package present");
}
const shellIntegrations = path.join(root, "apps/envsync-web/src/pages/ProjectIntegrations.tsx");
if (fs.existsSync(shellIntegrations)) {
	fail("apps/envsync-web still has ProjectIntegrations.tsx (should live in envsync-enterprise-web)");
} else {
	ok("shell does not ship ProjectIntegrations page source");
}
const viteConfig = fs.readFileSync(path.join(root, "apps/envsync-web/vite.config.ts"), "utf8");
if (!viteConfig.includes("envsync-enterprise-web") || !viteConfig.includes("@enterprise-modules")) {
	fail("envsync-web vite.config must alias @enterprise-modules to envsync-enterprise-web");
} else {
	ok("envsync-web Vite injects envsync-enterprise-web for enterprise builds");
}
const eeWebLicense = path.join(eeWeb, "LICENSE");
if (!fs.existsSync(eeWebLicense) || !/proprietary|Enterprise License/i.test(fs.readFileSync(eeWebLicense, "utf8"))) {
	fail("envsync-enterprise-web/LICENSE missing or not proprietary");
} else {
	ok("envsync-enterprise-web has proprietary LICENSE");
}

// 7) Phase 5c: management-web SPA deleted
const managementWeb = path.join(root, "apps/envsync-management-web");
if (fs.existsSync(managementWeb)) {
	fail("apps/envsync-management-web must be deleted (Phase 5c)");
} else {
	ok("apps/envsync-management-web is deleted");
}
const mergeScript = path.join(root, "scripts/merge-management-web-dist.ts");
if (fs.existsSync(mergeScript)) {
	fail("scripts/merge-management-web-dist.ts must be deleted (Phase 5c)");
} else {
	ok("merge-management-web-dist script is deleted");
}
const licensePage = path.join(root, "packages/envsync-enterprise-web/src/pages/LicenseSettings.tsx");
const syncPage = path.join(root, "packages/envsync-enterprise-web/src/pages/SyncOperations.tsx");
if (!fs.existsSync(licensePage) || !fs.existsSync(syncPage)) {
	fail("enterprise-web must include LicenseSettings + SyncOperations pages");
} else {
	ok("enterprise-web has License + Sync ops pages (ex-management-web)");
}

if (failed) {
	process.exit(1);
}
console.log("\nPackage boundary checks passed.");
