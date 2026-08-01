# Changelog

## Unreleased — E2E pack (create-org channel + enterprise routes)

### Added

- **API E2E:** `create-organization.e2e.test.ts` — hosted create-org, selfhost 403, create-workspace 404, cookie-session requirement
- **UI E2E:** `enterprise-routes.spec.ts` — organisation integrations/license/sync, project integrations, no management SPA
- **UI regression:** core route surface includes EE organisation routes

---

## Unreleased — hardening H7 (deferred close-out)

### Added

- **Hosted cutover:** [docs/HOSTED-CUTOVER.md](./docs/HOSTED-CUTOVER.md), `bun run check:hosted-cutover`
- **License-server deploy:** [docs/LICENSE-SERVER-DEPLOY.md](./docs/LICENSE-SERVER-DEPLOY.md)

### Changed

- EE capability services moved to `envsync-enterprise`: OIDC, SAML, rotation, dynamic secrets,
  log-forwarding, plus rotation/dynamic-secret engines (API keeps thin re-export shims).
- EE migrations (019 integrations, 022 OIDC, 023 rotation/dyn secrets, 024 SAML/log-forwarding)
  owned by `envsync-enterprise/src/migrations` with core migrator re-export shims.
- Boundary CI asserts H7 service + migration ownership.

---

## Unreleased — hardening H6 (docs + CI hygiene)

### Changed

- Program plan status points at completed hardening H1–H6; remaining ops listed.
- `docs/SUPPORT.md`: Hosted vs self-host edition matrix; Hosted FE must use `build:hosted`.
- `CONTRIBUTING.md`: deployment mode / edition footguns (enterprise default; missing mode → hosted).
- `envsync-web`: `envsync-enterprise-web` is a **devDependency** (OSS purity); CI boundary check.

---

## Unreleased — hardening H5 (design tokens)

### Added

- **`packages/envsync-ui`**: shared CSS tokens + Tailwind preset (MIT).
- `envsync-web` and `envsync-landing` consume `envsync-ui` instead of forked token blocks.

---

## Unreleased — hardening H4 (license issuer)

### Changed

- License-server issues **Ed25519 (EdDSA) entitlement JWTs** as `signed_lease` (features, max_orgs).
- Ops: [docs/LICENSE-RUNBOOK.md](./docs/LICENSE-RUNBOOK.md) for Hosted vs self-host EE.

---

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
