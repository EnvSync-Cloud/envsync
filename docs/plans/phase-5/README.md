# Phase 5 — Management API real product (kernel + enterprise packages)

**Branch:** `feat/the-big-update-p5`  
**Base track:** `feat/the-big-update`  
**Program:** [../2026-08-no-piggyback-program.md](../2026-08-no-piggyback-program.md)

## Goal

D5: management is a **product dependency graph**, not a surface flag / relative-path re-export of core `src/`.

## Dependency graph (shipped)

```text
envsync-kernel (MIT)
       ↑
  envsync-api (MIT)  ──public exports──► management-route-loaders, bootstrap, modules
       ↑
envsync-enterprise (PROPRIETARY)  ── module registry
       ↑
envsync-management-api (process entrypoint)
```

## What shipped

| ID | Change |
|----|--------|
| 5.1 | `packages/envsync-kernel` — errors + `ApiModule` types (MIT) |
| 5.3 | `packages/envsync-enterprise` — **canonical** management module list + proprietary LICENSE |
| 5.5 | `envsync-management-api` depends on enterprise + api + kernel; **no** `../../envsync-api/src` imports |
| 5.6 | Core `loadApiModules("core")` never includes management modules; management empty until `registerManagementModules` |
| 5.7 | Guard script `scripts/check-package-boundaries.ts` (core prod deps exclude enterprise) |
| 5.8 | Dual-license: kernel MIT; enterprise proprietary LICENSE |

### Public exports (`envsync-api`)

| Export | Purpose |
|--------|---------|
| `envsync-api/modules` | `registerManagementModules`, `loadApiModules`, background handlers |
| `envsync-api/management-route-loaders` | Route/worker factories for enterprise registry |
| `envsync-api/bootstrap` | Cache/DB/FGA init, ports, config |
| `envsync-api/create-management-app` | `createApiApp("management")` after registration |
| `envsync-api/instrumentation` | OTEL bootstrap |

### Management entrypoint pattern

```ts
import { registerManagementModules } from "envsync-api/modules";
import { enterpriseManagementModules } from "envsync-enterprise";
import { bootstrapRuntime } from "envsync-api/bootstrap";
import { createManagementApp } from "envsync-api/create-management-app";

registerManagementModules(enterpriseManagementModules);
await bootstrapRuntime("management");
const app = await createManagementApp();
```

## Deferred / follow-up (still Phase 5 program, later slices)

| ID | Work |
|----|------|
| 5.2 | Extract `envsync-core-domain` (org/app/secret services as library) |
| 5.3 cont. | Physically move EE services/routes out of `envsync-api/src` into enterprise package |
| 5.4 | Split migrations: core vs enterprise streams |
| 5.9 | `envsync-enterprise-web` package injection (FE 5b) |
| 5.10 | Confirm dual OpenAPI/SDK CI still green after split |
| 5c | Delete `envsync-management-web` after FE parity |

## Acceptance

- [x] No relative path from management-api into core `src/`  
- [x] Core production `package.json` does not depend on `envsync-enterprise`  
- [x] Management process wires license heartbeat + enterprise sync via registered modules  
- [x] Core surface excludes license/enterprise/oidc modules  
- [x] Proprietary LICENSE on `envsync-enterprise/`  
- [ ] Full physical EE source move + migration streams  
- [ ] OSS Docker SBOM / tree-shake audit of enterprise sources in core image  
- [ ] E2E enterprise flows on split packages (run when stack up)  

## Verify

```sh
bun run scripts/check-package-boundaries.ts
cd packages/envsync-api && bun test tests/mock/module-surfaces.test.ts
cd packages/envsync-management-api && bun test
```
