# envsync-enterprise

**License:** Proprietary — see [LICENSE](./LICENSE). Production use requires an EnvSync enterprise subscription.

## Role

Owns the **management API module registry** and (H3+) **enterprise integration/sync services**.

```text
envsync-kernel (MIT)
       ↑
  envsync-api (MIT) — single process; /api + /api/v1/manage when EE modules registered
       ↑
envsync-enterprise (PROPRIETARY) — modules + EE services + EE HTTP routes
  (bundled into envsync-api-enterprise image via entrypoint.enterprise.ts)
```

## What lives here

| Path | Contents |
|------|----------|
| `src/management-modules.ts` | Management HTTP module registry (`/api/v1/manage/{module}/...`) |
| `src/routes/*`, `src/controllers/*` | EE HTTP surface (P1) |
| `src/background.ts` | Enterprise sync worker + license heartbeat wiring |
| `src/services/*` | Integration, provider, rotation, OIDC/SAML, dyn-secret, etc. |

Shared core gates stay in `envsync-api` (entitlement, license-state, lock middleware).

## Usage

```ts
import { registerManagementModules } from "envsync-api/modules";
import { enterpriseManagementModules } from "envsync-enterprise";

registerManagementModules(enterpriseManagementModules);
// createApiApp("core") mounts product /api/* and manage /api/v1/manage/* when modules present
// Production EE image: packages/envsync-api entrypoint.enterprise.ts registers then boots core
```

Clients use the **core** SDKs (`@envsync-cloud/envsync-ts-sdk`, `envsync-go-sdk`) with API origin as base URL — not a separate management SDK.

## Path alias

EE code imports core via `envsync-api/ports` (not `@/*` into api src).
