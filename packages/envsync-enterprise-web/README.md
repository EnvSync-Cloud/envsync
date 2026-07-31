# envsync-enterprise-web

**License:** Proprietary — see [LICENSE](./LICENSE).

## Role (Phase 5b / D10)

Real **package injection** of enterprise dashboard modules into the MIT shell
`apps/envsync-web`. OSS builds resolve an empty stub; enterprise builds import
this package.

```text
apps/envsync-web (MIT shell)
        ↑ injects
packages/envsync-enterprise-web (PROPRIETARY WebModule[] + pages)
```

## Shell coupling

Pages import shell chrome via the `@shell/*` alias (configured in the web Vite
build to `apps/envsync-web/src/*`). That keeps UI primitives in one place while
enterprise routes/pages live only in this package.

## Usage

```ts
// apps/envsync-web vite alias @enterprise-modules → this package (enterprise)
// or → enterprise-modules.stub.ts (oss)
import { enterpriseWebModules } from "@enterprise-modules";
```

## Deferred (5c)

Port remaining `envsync-management-web` screens (license activate, etc.) into
modules here, then delete the management SPA.
