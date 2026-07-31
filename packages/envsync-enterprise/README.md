# envsync-enterprise

**License:** Proprietary — see [LICENSE](./LICENSE). Production use requires an EnvSync enterprise subscription.

## Role

Owns the **management API module registry** (Phase 5 / D5): which routes and background workers the management process mounts (license heartbeat, enterprise sync, OIDC/SAML, rotation, etc.).

```text
envsync-kernel (MIT)
       ↑
  envsync-api (MIT core process)
       ↑
envsync-enterprise (PROPRIETARY modules) ──► envsync-management-api (process)
```

## Usage

```ts
import { registerManagementModules } from "envsync-api/modules";
import { enterpriseManagementModules } from "envsync-enterprise";

registerManagementModules(enterpriseManagementModules);
// then create management app / start process
```

## Migration note

Route/service implementations still largely live under `packages/envsync-api/src` and are loaded via `envsync-api` public loaders. Physical move of EE services into this package continues in follow-up slices (migrations stream split, core-domain extraction).
