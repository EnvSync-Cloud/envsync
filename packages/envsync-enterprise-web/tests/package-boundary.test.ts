import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const pkgRoot = path.join(import.meta.dir, "..");
const srcRoot = path.join(pkgRoot, "src");

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("envsync-enterprise-web package boundary (Phase 5b)", () => {
  test("exports enterpriseWebModules", async () => {
    const mod = await import("../src/index.ts");
    expect(Array.isArray(mod.enterpriseWebModules)).toBe(true);
    expect(mod.enterpriseWebModules.map(module => module.name)).toEqual([
      "enterprise-integrations",
      "enterprise-license",
      "enterprise-sso",
    ]);
    const byName = Object.fromEntries(mod.enterpriseWebModules.map(module => [module.name, module]));
    expect(byName["enterprise-integrations"].requiredFeature).toBe("integrations");
    expect(byName["enterprise-license"].requiredFeature).toBeUndefined();
    expect(byName["enterprise-sso"].requiredFeature).toBe("saml");
    const integrationIds = byName["enterprise-integrations"].routes.map(r => r.id);
    expect(integrationIds).toContain("organisation-integrations");
    expect(integrationIds).toContain("organisation-sync");
    expect(integrationIds).not.toContain("organisation-license");
    expect(byName["enterprise-license"].routes.map(r => r.id)).toContain("organisation-license");
    expect(byName["enterprise-sso"].routes.map(r => r.id)).toContain("organisation-sso");
    expect(mod.enterpriseWebModules.some(module => module.name === "enterprise-kms")).toBe(false);
  });

  test("source lives in package (integrations + license + sync + sso pages present)", () => {
    expect(fs.existsSync(path.join(srcRoot, "pages/ProjectIntegrations.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(srcRoot, "pages/OrgIntegrations.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(srcRoot, "pages/LicenseSettings.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(srcRoot, "pages/SyncOperations.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(srcRoot, "pages/OrgSso.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(srcRoot, "modules.ts"))).toBe(true);
  });

  test("nav exposes Enterprise group with license, sync, and SSO", async () => {
    const mod = await import("../src/index.ts");
    const nav = mod.enterpriseWebModules.flatMap(module =>
      module.navGroups.flatMap(g => g.items.map(i => i.id)),
    );
    expect(nav).toContain("organisation-license");
    expect(nav).toContain("organisation-sync");
    expect(nav).toContain("organisation-integrations");
    expect(nav).toContain("organisation-sso");
  });

  test("SSO scope is admin/master and requires saml", async () => {
    const mod = await import("../src/index.ts");
    const rule = Object.fromEntries(
      mod.enterpriseWebModules.flatMap(module => Object.entries(module.scopeRules ?? {})),
    )["organisation-sso"];
    expect(rule).toBeTypeOf("function");
    const entitledAdmin = { role: { is_admin: true, is_master: false }, features: ["saml"] };
    const entitledEditor = { role: { is_admin: false, is_master: false }, features: ["saml"] };
    const unentitledAdmin = { role: { is_admin: true, is_master: false }, features: ["integrations"] };
    expect(rule(entitledAdmin as never)).toBe(true);
    expect(rule(entitledEditor as never)).toBe(false);
    expect(rule(unentitledAdmin as never)).toBe(false);
  });

  test("pages import shell chrome via @shell, not apps/envsync-web relative paths", () => {
    const files = listFiles(srcRoot);
    const relativePiggyback = /from\s+["']\.\.\/\.\.\/\.\.\/apps\/envsync-web/;
    const offenders: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      if (relativePiggyback.test(text)) {
        offenders.push(path.relative(pkgRoot, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  test("has proprietary LICENSE", () => {
    const license = fs.readFileSync(path.join(pkgRoot, "LICENSE"), "utf8");
    expect(license).toMatch(/proprietary|Enterprise License/i);
  });
});
