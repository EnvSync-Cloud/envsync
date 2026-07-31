# envsync-enterprise-web

**License:** Proprietary — see [LICENSE](./LICENSE).

## Role (Phase 5b–5c / D10–D11)

Real **package injection** of enterprise dashboard modules into the MIT shell
`apps/envsync-web`. OSS builds resolve an empty stub; enterprise builds import
this package.

```text
apps/envsync-web (MIT shell)
        ↑ injects
packages/envsync-enterprise-web (PROPRIETARY WebModule[] + pages)
```

## Modules

| Route | Capability (was management-web) |
|-------|----------------------------------|
| `/organisation/integrations` | Provider connections + org secrets |
| `/organisation/license` | Activate / verify license + install status |
| `/organisation/sync` | Org-wide sync runs + audit trail + retry |
| `/applications/:id/integrations*` | Project-level bindings / provider setup |

There is **no** separate `envsync-management-web` SPA or `/manage` merge step.

## Shell coupling

Pages import shell chrome via the `@shell/*` alias (configured in the web Vite
build to `apps/envsync-web/src/*`).

## Usage

```ts
// apps/envsync-web vite alias @enterprise-modules → this package (enterprise)
// or → enterprise-modules.stub.ts (oss)
import { enterpriseWebModules } from "@enterprise-modules";
```
