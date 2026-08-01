# Changelog

## Unreleased — hardening H3 (EE extraction)

### Changed

- Proprietary package `envsync-enterprise` owns enterprise integration/sync/provider
  services and certificate verifier (physical move from `envsync-api`).
- `envsync-api` keeps thin monorepo re-export shims (no package.json dependency).
- Enterprise sync worker background entry owned by `envsync-enterprise`.

### Deferred

- OIDC/SAML/rotation/dyn-secret service+route move; migration stream split.

---

## Unreleased — hardening H2 (naming)

### Changed

- API: `OrganizationProvisioningService.createOrganizationForExistingIdentity` (was WorkspaceProvisioning*).
- Web: `CreateOrganizationDialog`; e2e `organizations.spec.ts`.
- Go SDK: `CreateOrganizationRequest` type alias for request body.

---

## Unreleased — hardening H1 (Hosted cutover)

### Fixed

- **Hosted FE deploy** (`.github/workflows/deploy-fe.yaml`) builds **`build:hosted`** (enterprise dashboard modules), not OSS stub.
- Path filter includes `packages/envsync-enterprise-web/**`.
- **Public SDKs:** `createOrganization` → `POST /api/auth/create-organization`; deprecated `createWorkspace` wrappers call the new path (API no longer has create-workspace).

### Verify

- `bun run check:boundaries` asserts deploy-fe edition + SDK paths.

---

## Unreleased — program track `feat/the-big-update` (Phase 7)

### Removed

- **API:** `POST /auth/create-workspace` compatibility alias (use `POST /auth/create-organization`).
- **Deploy runtime:** product use of `ENVSYNC_MAX_ORGS` without support override (max orgs from entitlement claims).

### Changed

- Self-host multi-org limits: entitlement claims only; optional
  `ENVSYNC_MAX_ORGS_SUPPORT_OVERRIDE=true` + `ENVSYNC_MAX_ORGS` for stranded support installs.
- Dashboard: org create dialog/switcher testids use `create-organization-*` /
  `organization-switcher-*`.
- Dual-license docs, support matrix, and no-piggyback package boundaries (Phases 0–6).

### Notes

- No documented reliance on piggyback paths (OSS deploy monorepo spawn, management SPA,
  relative management-api → core `src` imports).
- Optional template: `docs/deploy/management-network-policy.example.md`.

---

Historical release notes may live in package-level changelogs / GitHub Releases.
