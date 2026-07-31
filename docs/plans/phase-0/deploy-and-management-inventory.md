# Phase 0.3 — Deploy CLI + management API piggyback inventory

**Branch:** `feat/the-big-update-p0`  
**Target:** D4, D5 — real products, shared libs only.

## Deploy packages

| Package | Path | Role today | Piggyback? | Target phase |
|---------|------|------------|------------|--------------|
| `@envsync-cloud/deploy-core` | `packages/deploy-core` | Plan/validate both editions | Shared lib OK | Keep; slim EE schema later |
| `@envsync-cloud/deploy` | `packages/deploy` | OSS CLI; **lifecycle spawns** `bun run packages/deploy-cli/src/index.ts` | **Yes — critical** | **P3:** full OSS lifecycle, no spawn |
| `@envsync-cloud/deploy-cli` | `packages/deploy-cli` | Full Swarm engine; enterprise defaults; public npm | **Yes — public EE** | **P3:** private `deploy-enterprise`, distinct bin |

### Spawn shim evidence

`packages/deploy/src/index.ts` → `spawnSync("bun", ["run", "packages/deploy-cli/src/index.ts", ...])` with monorepo CWD.

### Edition / topology notes

| Issue | Location | Phase |
|-------|----------|-------|
| Default edition enterprise in CLI | `deploy-cli` normalizeConfig | P3 |
| Landing required for enterprise plan | `deploy-core` validateEditionRules | P2 + P3 |
| OSS image matrix may pin enterprise web | deploy-cli managed prefixes | P3 |
| Plan vs render drift (observability) | deploy-core vs render.ts | P3 |

## Management API

| Item | Path | Piggyback? | Target |
|------|------|------------|--------|
| Package shell | `packages/envsync-management-api` | Re-exports `../../envsync-api/src/...` | **P5:** real package |
| Entrypoint | `src/entrypoint.ts` | Relative imports into core | P5 |
| Modules | `envsync-api/src/modules/management-modules.ts` | Inside core package | P5 → `envsync-enterprise` |
| Factory | `envsync-api/src/app/factory.ts` | Shared core+management | Kernel later |
| EE migrations | `envsync-api` migrations 018+ | Always migrate with OSS | P5 split streams |
| Dockerfile | `docker/management-api.Dockerfile` | Bundles core | P5 |

## Interim (do not expand piggybacks)

- New EE HTTP modules: register only via `management-modules.ts` until package split; note in PR.  
- New deploy lifecycle: do not add more spawn targets from `packages/deploy`.  
