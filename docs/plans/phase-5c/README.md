# Phase 5c — Kill `envsync-management-web` (absorb into enterprise-web)

**Branch:** `feat/the-big-update-p5c`  
**Base track:** `feat/the-big-update`  
**Program:** [../2026-08-no-piggyback-program.md](../2026-08-no-piggyback-program.md) · §6A.3 / D11

## Goal

Zero second dashboard SPA. License, providers, secrets, and sync ops live as
`envsync-enterprise-web` modules inside `envsync-web`.

## Capability map

| management-web | Dashboard home now |
|----------------|--------------------|
| License activate / verify | `/organisation/license` |
| System / install status | same page |
| Provider connections + create | `/organisation/integrations` (5b) |
| Org secrets + create | same |
| Sync runs + filters + audit + retry | `/organisation/sync` |
| Project integrations | `/applications/:id/integrations*` (5b) |

## What shipped

| Change |
|--------|
| New EE pages: `LicenseSettings`, `SyncOperations` |
| License/system/activate/verify hooks on management SDK |
| Nav group **Enterprise**: Integrations, Sync ops, License |
| Org Settings bento links to all three |
| **Deleted** `apps/envsync-management-web` |
| **Deleted** `scripts/merge-management-web-dist.ts` |
| Removed turbo `envsync-management-web#dev` |
| LICENSE carve-out no longer lists management-web app |

## Acceptance

- [x] Zero workspace package `apps/envsync-management-web`  
- [x] Zero `dist/manage` merge script  
- [x] License + provider + sync UX from enterprise dashboard navigation  
- [x] OSS shell has no management-web dependency  
- [ ] Hosted E2E click-through of license page (when stack available)  

## Verify

```sh
test ! -d apps/envsync-management-web
test ! -f scripts/merge-management-web-dist.ts
bun run check:boundaries
cd packages/envsync-enterprise-web && bun test
cd apps/envsync-web && VITE_SERVER_LICENSE=enterprise bun run build
```
