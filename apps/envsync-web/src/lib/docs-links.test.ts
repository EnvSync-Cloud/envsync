import { describe, expect, test } from "bun:test";

import { buildProjectNavItems } from "@/components/shell/context-nav";
import { getWebNavGroups } from "@/modules/load-modules";

import {
  DOCS_BASE,
  DOCS_PAGES,
  NAV_DOCS,
  SETTINGS_TAB_DOCS,
  UNDOCUMENTED_FEATURE_IDS,
  docsUrlForNavItem,
  docsUrlForPathname,
  docsUrlForSettingsTab,
} from "./docs-links";

const publishedPages = new Set<string>(Object.values(DOCS_PAGES));
const pageOf = (url: string) => url.replace(DOCS_BASE, "").split("#")[0];

describe("feature docs mapping", () => {
  test("every mapped URL points at a published docs page", () => {
    const mapped = [...Object.values(NAV_DOCS), ...Object.values(SETTINGS_TAB_DOCS)];
    expect(mapped.length).toBeGreaterThan(10);
    for (const url of mapped) {
      expect(url.startsWith(`${DOCS_BASE}/docs/`)).toBe(true);
      expect(publishedPages.has(pageOf(url))).toBe(true);
    }
  });

  test("every sidebar feature is mapped or explicitly undocumented", () => {
    const navIds = [
      ...getWebNavGroups().flatMap((group) => group.items.map((item) => item.id)),
      ...buildProjectNavItems("app_1", ["change-requests", "applications-integrations"]).map(
        (item) => item.id,
      ),
    ];

    for (const id of navIds) {
      const covered = docsUrlForNavItem(id) !== undefined || UNDOCUMENTED_FEATURE_IDS.includes(id);
      expect(covered, `nav item "${id}" needs a docs mapping or an undocumented entry`).toBe(true);
    }
  });

  test("mapped ids and undocumented ids never overlap", () => {
    for (const id of UNDOCUMENTED_FEATURE_IDS) {
      expect(NAV_DOCS[id], `"${id}" is mapped and listed as undocumented`).toBeUndefined();
      expect(SETTINGS_TAB_DOCS[id]).toBeUndefined();
    }
  });

  test("page header lookup covers every feature route", () => {
    expect(docsUrlForPathname("/")).toBe(`${DOCS_BASE}/docs/envsync`);
    expect(docsUrlForPathname("/projects/app_1/secrets")).toContain("secret-encryption--storage");
    expect(docsUrlForPathname("/projects/app_1/pit/secrets")).toContain("point-in-time-history");
    expect(docsUrlForPathname("/projects/app_1/settings/service-tokens")).toContain("service-tokens");
    expect(docsUrlForPathname("/projects/app_1/settings/rotation")).toContain("secret-rotation");
    expect(docsUrlForPathname("/projects/app_1/integrations")).toContain("provider-integrations");
    expect(docsUrlForPathname("/apikeys")).toContain("api-keys");
    expect(docsUrlForPathname("/gpgkeys")).toContain("gpg-keys");
    expect(docsUrlForPathname("/org/certificates")).toContain("security/certificates");
    expect(docsUrlForPathname("/org/access/teams")).toContain("core-concepts/teams");
    expect(docsUrlForPathname("/org/webhooks")).toContain("webhooks");
    expect(docsUrlForPathname("/org")).toContain("organization-settings");
    expect(docsUrlForPathname("/settings")).toContain("account-settings");
    expect(docsUrlForPathname("/organisation/keys")).toContain("encryption-and-kms");
    expect(docsUrlForPathname("/organisation/license")).toContain("dashboard/license");
    expect(docsUrlForPathname("/organisation/sync")).toContain("sync-operations");
    expect(docsUrlForPathname("/organisation/integrations")).toContain("provider-integrations");
  });

  test("auth screens and non-feature routes get no docs button", () => {
    expect(docsUrlForPathname("/login")).toBeUndefined();
    expect(docsUrlForPathname("/auth/callback")).toBeUndefined();
    expect(docsUrlForSettingsTab("unknown-tab")).toBeUndefined();
  });
});
