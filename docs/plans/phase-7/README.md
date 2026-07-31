# Phase 7 — Hardening, deprecations, cleanup

**Branch:** `feat/the-big-update-p7`  
**Base track:** `feat/the-big-update`  
**Program:** [../2026-08-no-piggyback-program.md](../2026-08-no-piggyback-program.md)

## Goal

Close interim shims from earlier phases; document that piggyback paths are gone.

## What shipped

| ID | Change |
|----|--------|
| 7.1 | `ENVSYNC_MAX_ORGS` ignored unless `ENVSYNC_MAX_ORGS_SUPPORT_OVERRIDE=true`; claims/default-1 primary |
| 7.2 | No dead duplicate renderers found in deploy-cli; deploy runtime no longer sets product `ENVSYNC_MAX_ORGS` |
| 7.3 | Removed `POST /auth/create-workspace`; only `create-organization` remains |
| 7.4 | Example private management network policy: [../../deploy/management-network-policy.example.md](../../deploy/management-network-policy.example.md) |
| 7.5 | Browser BFF — **not** done (out of program unless scheduled) |

### FE / tests

- Auth context: `createOrganization` / `isCreatingOrganization`
- Testids: `create-organization-*`, `organization-switcher-*`
- Mock auth + org-provisioning updated

### Changelog

Root [CHANGELOG.md](../../../CHANGELOG.md) Unreleased section.

## Acceptance

- [x] No product reliance on `ENVSYNC_MAX_ORGS` alone for multi-org  
- [x] create-workspace HTTP route removed  
- [x] Changelog documents closed deprecations  
- [x] No documented piggyback paths (boundaries script + program docs)  
- [ ] 7.5 BFF — deferred  

## Verify

```sh
rg -n '"/create-workspace"' packages/envsync-api/src/routes   # expect no matches
bun run check:boundaries
cd packages/envsync-api && bun test tests/mock/edition-policy.test.ts tests/mock/auth.test.ts tests/mock/org-provisioning.test.ts
cd packages/deploy-core && bun test
```
