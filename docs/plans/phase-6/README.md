# Phase 6 — Dual-license polish + naming (D6 + D2)

**Branch:** `feat/the-big-update-p6`  
**Base track:** `feat/the-big-update`  
**Program:** [../2026-08-no-piggyback-program.md](../2026-08-no-piggyback-program.md)

## Goal

Legal and product language match the dual-license monorepo architecture.

## What shipped

| ID | Change |
|----|--------|
| 6.1 | Root [LICENSE](../../../LICENSE) rewritten (MIT default + proprietary carve-out, PostHog-style) |
| 6.2 | Enterprise package LICENSEs already present (enterprise, enterprise-web, management-api, deploy-cli) |
| 6.3 | [EDITIONING.md](../../../EDITIONING.md) dual-license monorepo (private-superset optional); [CONTRIBUTING.md](../../../CONTRIBUTING.md) contribution terms for proprietary paths |
| 6.4 | `POST /auth/create-organization` preferred; `POST /auth/create-workspace` deprecated OpenAPI alias |
| 6.5 | Dashboard UI: Organization wording (switcher, dialog errors, loading/onboarding copy) |
| 6.6 | CLI already used “organization” in help; no google-workspace IdP renames |
| 6.7 | [docs/SUPPORT.md](../../SUPPORT.md) Hosted / OSS SH / EE SH matrix |

## Deprecation window

| Legacy | Preferred | Remove |
|--------|-----------|--------|
| `POST /auth/create-workspace` | `POST /auth/create-organization` | Phase 7 |
| Internal `createWorkspace` names / testids | Gradual | Phase 7 (optional) |

## Acceptance

- [x] Dual-license root LICENSE + EDITIONING dual-license monorepo  
- [x] No primary UI path says “Create workspace”  
- [x] Support matrix published  
- [ ] Formal legal review checklist (internal — not blocked in repo)  
- [ ] SDK regen to pick up `createOrganization` OpenAPI operation (run generate when convenient)  

## Verify

```sh
rg -n "Create workspace" apps/envsync-web --glob '*.tsx'   # expect no user-facing hits
test -f docs/SUPPORT.md && test -f EDITIONING.md
# API both paths exist
rg -n "create-organization|create-workspace" packages/envsync-api/src/routes/auth.route.ts
```
