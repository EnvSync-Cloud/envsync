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

// 8) Phase 7: create-workspace route removed
const authRoute = fs.readFileSync(
	path.join(root, "packages/envsync-api/src/routes/auth.route.ts"),
	"utf8",
);
if (authRoute.includes('"/create-workspace"') || authRoute.includes("'/create-workspace'")) {
	fail("create-workspace route must be removed (Phase 7); use create-organization only");
} else if (!authRoute.includes("create-organization")) {
	fail("create-organization route missing from auth.route.ts");
} else {
	ok("create-workspace removed; create-organization present");
}

// 9) H1: Hosted FE deploy must not build OSS dashboard
const deployFe = fs.readFileSync(path.join(root, ".github/workflows/deploy-fe.yaml"), "utf8");
if (/bun run --filter envsync-web build:oss/.test(deployFe)) {
	fail("deploy-fe.yaml must not use build:oss for Hosted web (use build:hosted or build:enterprise)");
} else if (!/build:hosted|build:enterprise/.test(deployFe)) {
	fail("deploy-fe.yaml must build Hosted web with enterprise modules (build:hosted or build:enterprise)");
} else if (!deployFe.includes("envsync-enterprise-web")) {
	fail("deploy-fe.yaml path filters should include packages/envsync-enterprise-web");
} else {
	ok("deploy-fe Hosted web uses enterprise/hosted build + enterprise-web path filter");
}

// 10) H1: SDK clients must not call removed create-workspace URL
const tsAuth = fs.readFileSync(
	path.join(root, "sdks/envsync-ts-sdk/src/services/AuthenticationService.ts"),
	"utf8",
);
const goAuth = fs.readFileSync(
	path.join(root, "sdks/envsync-go-sdk/sdk/authentication/client.go"),
	"utf8",
);
if (tsAuth.includes("url: '/api/auth/create-workspace'") || tsAuth.includes('url: "/api/auth/create-workspace"')) {
	fail("envsync-ts-sdk must not POST /api/auth/create-workspace");
} else if (!tsAuth.includes("/api/auth/create-organization")) {
	fail("envsync-ts-sdk must call /api/auth/create-organization");
} else {
	ok("envsync-ts-sdk uses create-organization path");
}
if (goAuth.includes('"/api/auth/create-workspace"') || goAuth.includes("'/api/auth/create-workspace'")) {
	fail("envsync-go-sdk must not POST /api/auth/create-workspace");
} else if (!goAuth.includes("/api/auth/create-organization")) {
	fail("envsync-go-sdk must call /api/auth/create-organization");
} else {
	ok("envsync-go-sdk uses create-organization path");
}

// 11) H3/H7: enterprise capability services live under envsync-enterprise
const eeServicesDir = path.join(root, "packages/envsync-enterprise/src/services");
const requiredEeServices = [
	"enterprise-sync.service.ts",
	"enterprise-integration.service.ts",
	"enterprise-provider.service.ts",
	"enterprise-provider-sync.service.ts",
	"enterprise-certificate-verifier.service.ts",
	// H7 capability extraction
	"oidc.service.ts",
	"saml.service.ts",
	"rotation.service.ts",
	"dynamic_secret.service.ts",
	"log-forwarding.service.ts",
];
for (const name of requiredEeServices) {
	const eePath = path.join(eeServicesDir, name);
	const apiShim = path.join(root, "packages/envsync-api/src/services", name);
	if (!fs.existsSync(eePath)) {
		fail(`H3: missing envsync-enterprise service ${name}`);
	} else if (!fs.existsSync(apiShim)) {
		fail(`H3: missing envsync-api re-export shim for ${name}`);
	} else {
		const shim = fs.readFileSync(apiShim, "utf8");
		// Shim should be a thin re-export, not a full copy of implementation
		if (!shim.includes("envsync-enterprise") || !shim.includes("export * from")) {
			fail(`H3: envsync-api ${name} should re-export from envsync-enterprise`);
		} else if (shim.split("\n").filter(l => l.trim().length > 0).length > 12) {
			fail(`H3: envsync-api ${name} shim looks too large (expected thin re-export)`);
		}
	}
}
if (fs.existsSync(path.join(eeServicesDir, "enterprise-sync.service.ts"))) {
	const impl = fs.readFileSync(path.join(eeServicesDir, "enterprise-sync.service.ts"), "utf8");
	if (impl.includes("export class EnterpriseSyncService") || impl.includes("class EnterpriseSyncService")) {
		ok("H3: enterprise-sync implementation owned by envsync-enterprise");
	} else {
		fail("H3: enterprise-sync.service.ts in enterprise package looks empty/wrong");
	}
}

// H7: engines + EE migrations owned by envsync-enterprise
const eeRotEngines = path.join(eeServicesDir, "rotation-engines", "index.ts");
const eeDynEngines = path.join(eeServicesDir, "dynamic-secret-engines", "index.ts");
if (!fs.existsSync(eeRotEngines) || !fs.existsSync(eeDynEngines)) {
	fail("H7: rotation-engines and dynamic-secret-engines must live under envsync-enterprise");
} else {
	ok("H7: rotation + dynamic-secret engines owned by envsync-enterprise");
}
const eeMigrationsDir = path.join(root, "packages/envsync-enterprise/src/migrations");
const requiredEeMigrations = [
	"019_enterprise_integrations_foundation.ts",
	"022_oidc_providers.ts",
	"023_dynamic_secrets.ts",
	"023_secret_rotation.ts",
	"024_log_forwarding_configs.ts",
	"024_saml_providers.ts",
];
for (const name of requiredEeMigrations) {
	const eeMig = path.join(eeMigrationsDir, name);
	const apiMig = path.join(root, "packages/envsync-api/src/libs/db/migrations", name);
	if (!fs.existsSync(eeMig)) {
		fail(`H3.4: missing envsync-enterprise migration ${name}`);
	} else if (!fs.existsSync(apiMig)) {
		fail(`H3.4: missing envsync-api migration re-export for ${name}`);
	} else {
		const shim = fs.readFileSync(apiMig, "utf8");
		if (!shim.includes("envsync-enterprise") || !shim.includes("export { up, down }")) {
			fail(`H3.4: ${name} in envsync-api must re-export up/down from envsync-enterprise`);
		}
	}
}
ok("H3.4: EE migrations owned by envsync-enterprise with core re-export shims");

// 12) H6: envsync-web must not list proprietary EE web as a production dependency
const webPkg = JSON.parse(
	fs.readFileSync(path.join(root, "apps/envsync-web/package.json"), "utf8"),
) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
if (webPkg.dependencies?.["envsync-enterprise-web"]) {
	fail(
		"envsync-web production dependencies must not include envsync-enterprise-web (use devDependency for Vite enterprise builds)",
	);
} else if (!webPkg.devDependencies?.["envsync-enterprise-web"]) {
	fail("envsync-web must list envsync-enterprise-web as a devDependency for enterprise/hosted Vite builds");
} else {
	ok("envsync-web keeps envsync-enterprise-web as devDependency only");
}

if (failed) {
	process.exit(1);
}
console.log("\nPackage boundary checks passed.");
