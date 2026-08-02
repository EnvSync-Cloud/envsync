/**
 * Package boundary CI guards (no-piggyback + open-core).
 * Manage surface is on core API under /api/v1/manage — no envsync-management-api process.
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

// 1) Retired second process + separate management SDKs must stay gone
if (fs.existsSync(path.join(root, "packages/envsync-management-api"))) {
	fail("packages/envsync-management-api was removed; manage is on core API (/api/v1/manage)");
} else {
	ok("envsync-management-api package is removed (unified manage on core)");
}
if (
	fs.existsSync(path.join(root, "sdks/envsync-management-ts-sdk")) ||
	fs.existsSync(path.join(root, "sdks/envsync-management-go-sdk"))
) {
	fail("management SDKs were merged into core envsync-ts-sdk / envsync-go-sdk");
} else {
	ok("separate management SDKs are removed (clients use core SDKs)");
}

// 2) envsync-api must not depend on envsync-enterprise (prod or dev).
// Monorepo re-export shims use relative paths only — a package.json edge creates a
// Turbo cycle with envsync-enterprise's peer/devDep on envsync-api.
const apiPkg = JSON.parse(
	fs.readFileSync(path.join(root, "packages/envsync-api/package.json"), "utf8"),
) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
if (apiPkg.dependencies?.["envsync-enterprise"]) {
	fail("envsync-api production dependencies must not include envsync-enterprise");
} else if (apiPkg.devDependencies?.["envsync-enterprise"]) {
	fail(
		"envsync-api devDependencies must not include envsync-enterprise (Turbo cycle; use relative re-export shims only)",
	);
} else {
	ok("envsync-api package.json has no envsync-enterprise dependency (prod or dev)");
}

// 3) Enterprise API bundle entry exists (docker/api-enterprise.Dockerfile)
const eeEntry = path.join(root, "packages/envsync-api/src/entrypoint.enterprise.ts");
const eeDockerfile = path.join(root, "docker/api-enterprise.Dockerfile");
if (!fs.existsSync(eeEntry) || !fs.existsSync(eeDockerfile)) {
	fail("enterprise API entrypoint + docker/api-enterprise.Dockerfile required for EE image");
} else {
	ok("enterprise API bundle entry + Dockerfile present");
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

// 13) P0: envsync-enterprise must not relative-import envsync-api/src (monorepo piggyback)
function walkTsFiles(dir: string, out: string[] = []): string[] {
	if (!fs.existsSync(dir)) return out;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walkTsFiles(full, out);
		else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(full);
	}
	return out;
}
const eeSrcRoot = path.join(root, "packages/envsync-enterprise/src");
const relativeApiPiggyback =
	/\.\.\/\.\.\/envsync-api\/|envsync-api\/src\/|from\s+["']\.\.\/\.\.\/envsync-api/;
let eeRelativeHits = 0;
for (const file of walkTsFiles(eeSrcRoot)) {
	const text = fs.readFileSync(file, "utf8");
	if (relativeApiPiggyback.test(text)) {
		fail(`envsync-enterprise relative/src piggyback: ${path.relative(root, file)}`);
		eeRelativeHits++;
	}
}
if (eeRelativeHits === 0) {
	ok("envsync-enterprise has no relative monorepo imports into envsync-api/src");
}
// Background must use public package export for license heartbeat
const eeBackground = fs.readFileSync(path.join(eeSrcRoot, "background.ts"), "utf8");
const eeBackgroundCode = eeBackground
	.split("\n")
	.filter(line => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
	.join("\n");
if (!eeBackground.includes("envsync-api/license") || relativeApiPiggyback.test(eeBackgroundCode)) {
	fail("envsync-enterprise background.ts must start license heartbeat via envsync-api/license only");
} else {
	ok("envsync-enterprise license heartbeat uses public envsync-api/license export");
}
const eeCa = path.join(eeSrcRoot, "assets/license/envsync-enterprise-root-ca.pem");
if (!fs.existsSync(eeCa)) {
	fail("envsync-enterprise must ship envsync-enterprise-root-ca.pem under src/assets/license");
} else {
	ok("envsync-enterprise owns bundled enterprise root CA PEM");
}

// 16) P2: enterprise must not use @/* path alias into envsync-api/src
const eeTsconfig = JSON.parse(
	fs.readFileSync(path.join(root, "packages/envsync-enterprise/tsconfig.json"), "utf8"),
) as { compilerOptions?: { paths?: Record<string, string[]> } };
const eePaths = eeTsconfig.compilerOptions?.paths ?? {};
const atStar = eePaths["@/*"]?.[0] ?? "";
if (atStar.includes("envsync-api")) {
	fail("P2: envsync-enterprise tsconfig must not map @/* into envsync-api/src");
}
let eeAtImports = 0;
for (const file of walkTsFiles(path.join(root, "packages/envsync-enterprise/src"))) {
	const text = fs.readFileSync(file, "utf8");
	if (/from\s+["']@\//.test(text) || /import\s*\(\s*["']@\//.test(text)) {
		fail(`P2: envsync-enterprise still uses @/ deep import: ${path.relative(root, file)}`);
		eeAtImports++;
	}
}
if (eeAtImports === 0) {
	ok("P2: envsync-enterprise has no @/ imports (uses envsync-api/ports)");
}
const portsIndex = path.join(root, "packages/envsync-api/src/public/ports/index.ts");
if (!fs.existsSync(portsIndex)) {
	fail("P2: missing envsync-api public ports surface");
} else {
	ok("P2: envsync-api/ports public surface present");
}
const uiButton = path.join(root, "packages/envsync-ui/src/components/button.tsx");
const uiCn = path.join(root, "packages/envsync-ui/src/lib/cn.ts");
if (!fs.existsSync(uiButton) || !fs.existsSync(uiCn)) {
	fail("P2: envsync-ui must ship shared primitives (button) + cn util");
} else {
	ok("P2: envsync-ui includes cn + button/badge/card/input primitives");
}

// 15) P1: EE HTTP surface (routes/controllers) lives under envsync-enterprise
const eeHttpRoutes = [
	"enterprise.route.ts",
	"oidc.route.ts",
	"saml.route.ts",
	"rotation.route.ts",
	"dynamic_secret.route.ts",
	"log-forwarding.route.ts",
	"license.route.ts",
];
const eeRoutesDir = path.join(root, "packages/envsync-enterprise/src/routes");
const apiRoutesDir = path.join(root, "packages/envsync-api/src/routes");
for (const name of eeHttpRoutes) {
	if (!fs.existsSync(path.join(eeRoutesDir, name))) {
		fail(`P1: missing envsync-enterprise route ${name}`);
	}
	if (fs.existsSync(path.join(apiRoutesDir, name))) {
		fail(`P1: envsync-api must not ship EE route ${name} (moved to envsync-enterprise)`);
	}
}
const mgmtModules = fs.readFileSync(
	path.join(root, "packages/envsync-enterprise/src/management-modules.ts"),
	"utf8",
);
if (mgmtModules.includes("L.oidc") || mgmtModules.includes("L.enterprise") || mgmtModules.includes("L.license")) {
	fail("P1: enterpriseManagementModules must load EE routes from local ./routes, not api loaders");
}
if (!mgmtModules.includes("./routes/oidc.route") || !mgmtModules.includes("./routes/enterprise.route")) {
	fail("P1: enterpriseManagementModules must import local EE route modules");
} else {
	ok("P1: EE HTTP routes owned by envsync-enterprise management modules");
}
// 14) P0: OSS deploy owns the engine; must not import deploy-cli
const deploySrc = path.join(root, "packages/deploy/src");
const deployIndex = fs.readFileSync(path.join(deploySrc, "index.ts"), "utf8");
const deployCliEngine = path.join(deploySrc, "cli.ts");
const deployImportPiggyback = /from\s+["'][^"']*deploy-cli|import\s*\(\s*["'][^"']*deploy-cli|packages\/deploy-cli/;
if (!fs.existsSync(deployCliEngine)) {
	fail("packages/deploy must own src/cli.ts (deploy engine source of truth)");
} else if (deployImportPiggyback.test(deployIndex)) {
	fail("packages/deploy must not import packages/deploy-cli");
} else {
	ok("OSS deploy owns cli.ts and does not import deploy-cli");
}
const deployPkg = JSON.parse(
	fs.readFileSync(path.join(root, "packages/deploy/package.json"), "utf8"),
) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
if (
	deployPkg.dependencies?.["@envsync-cloud/deploy-enterprise"] ||
	deployPkg.devDependencies?.["@envsync-cloud/deploy-enterprise"]
) {
	fail("OSS deploy must not depend on deploy-enterprise");
}
const deployCliPkg = JSON.parse(
	fs.readFileSync(path.join(root, "packages/deploy-cli/package.json"), "utf8"),
) as { dependencies?: Record<string, string> };
if (!deployCliPkg.dependencies?.["@envsync-cloud/deploy"]) {
	fail("deploy-enterprise (deploy-cli) must depend on @envsync-cloud/deploy (EE → OSS)");
} else {
	ok("deploy-enterprise depends on OSS @envsync-cloud/deploy (open-core direction)");
}
const deployCliEntry = fs.readFileSync(path.join(root, "packages/deploy-cli/src/index.ts"), "utf8");
if (!deployCliEntry.includes("@envsync-cloud/deploy/cli") || deployCliEntry.split("\n").length > 40) {
	fail("deploy-cli entry must be a thin wrapper importing @envsync-cloud/deploy/cli");
} else {
	ok("deploy-cli is a thin EE entry over OSS deploy engine");
}

if (failed) {
	process.exit(1);
}
console.log("\nPackage boundary checks passed.");
