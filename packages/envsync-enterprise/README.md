# envsync-enterprise

**License:** Proprietary — see [LICENSE](./LICENSE). Production use requires an EnvSync enterprise subscription.

## Role

Owns the **management API module registry** and (H3+) **enterprise integration/sync services**.

```text
envsync-kernel (MIT)
       ↑
  envsync-api (MIT) — core process; thin re-exports for moved EE services
       ↑
envsync-enterprise (PROPRIETARY) — modules + EE services
       ↑
envsync-management-api (process)
```

## What lives here (H3)

| Path | Contents |
|------|----------|
| `src/management-modules.ts` | Management HTTP module registry |
| `src/background.ts` | Enterprise sync worker + license heartbeat wiring |
| `src/services/enterprise-*.service.ts` | Integration, provider catalog, provider sync, org sync, cert verifier |

Still in `envsync-api` (shared with core gates / lock middleware): entitlement, license-state, OIDC/SAML/rotation/dyn-secret engines, EE HTTP routes/controllers.

## Usage

```ts
import { registerManagementModules } from "envsync-api/modules";
import { enterpriseManagementModules } from "envsync-enterprise";

registerManagementModules(enterpriseManagementModules);
```

## Path alias

Services import core infrastructure via `@/*` → `packages/envsync-api/src/*` (see `tsconfig.json`). Management API bundler resolves the same alias.
