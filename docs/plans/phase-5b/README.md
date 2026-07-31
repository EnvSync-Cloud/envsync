# Phase 5b — Enterprise dashboard package injection (`envsync-enterprise-web`)

**Branch:** `feat/the-big-update-p5b`  
**Base track:** `feat/the-big-update`  
**Program:** [../2026-08-no-piggyback-program.md](../2026-08-no-piggyback-program.md) · §6A / D10

## Goal

EE FE is a **real package** (`packages/envsync-enterprise-web`), not in-tree pages hidden by Vite stub alone.

## Dependency / injection

```text
apps/envsync-web (MIT shell)
   Vite @enterprise-modules ──► packages/envsync-enterprise-web (PROPRIETARY)  [enterprise build]
                            └──► enterprise-modules.stub.ts (empty)            [OSS build]
   Vite @shell ──► apps/envsync-web/src   (chrome for EE pages)
```

| Build | Modules |
|-------|---------|
| `VITE_SERVER_LICENSE=oss` / `build:oss` | Empty stub only |
| Enterprise / default | `enterpriseWebModules` from package |

## What shipped

| Item | Detail |
|------|--------|
| Package | `packages/envsync-enterprise-web` + proprietary LICENSE |
| Moved | Integrations pages, enterprise components, management client hooks, provider UI config |
| Shell | Deleted in-tree `ProjectIntegrations*`, `OrgIntegrations`, `components/enterprise`, `api/enterprise` |
| Vite | `@enterprise-modules` → package or stub; `@shell` for EE → shell UI |
| Seam | Single injection via `@enterprise-modules` (external-modules stays empty FOSS hook) |
| CI | `scripts/check-package-boundaries.ts` asserts package + no shell ProjectIntegrations |

## Not in 5b (→ 5c)

- Port `envsync-management-web` license/provider SPA screens into modules
- Delete management-web app + merge script
- `envsync-ui` tokens package (D12 parallel)

## Acceptance

- [x] Real `envsync-enterprise-web` package with WebModule registry  
- [x] Integrations pages out of core web tree  
- [x] OSS resolves empty stub; enterprise resolves package  
- [x] Proprietary LICENSE on enterprise-web  
- [ ] Full OSS production bundle SBOM excludes EE page symbols (optional follow-up)  
- [ ] 5c: management-web deleted after parity  

## Verify

```sh
bun run check:boundaries
cd packages/envsync-enterprise-web && bun test
cd apps/envsync-web && VITE_SERVER_LICENSE=oss bun run build
cd apps/envsync-web && VITE_SERVER_LICENSE=enterprise bun run build
```
