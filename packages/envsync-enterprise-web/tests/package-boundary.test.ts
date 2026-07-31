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
    expect(mod.enterpriseWebModules.length).toBeGreaterThan(0);
    expect(mod.enterpriseWebModules[0].name).toBe("enterprise-integrations");
    expect(mod.enterpriseWebModules[0].routes.some(r => r.id === "organisation-integrations")).toBe(true);
  });

  test("source lives in package (integrations pages present)", () => {
    expect(fs.existsSync(path.join(srcRoot, "pages/ProjectIntegrations.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(srcRoot, "pages/OrgIntegrations.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(srcRoot, "modules.ts"))).toBe(true);
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
