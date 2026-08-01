# No-piggyback P0 — graph honesty

**Branch:** `feat/the-big-update-no-piggyback-p0`  
**Context:** Post-hardening audit — physical independence incomplete.

## Delivered

| Item | Change |
|------|--------|
| Enterprise background | License heartbeat via `envsync-api/license` (public export), not `../../envsync-api/...` |
| Enterprise CA | PEM owned under `envsync-enterprise/src/assets/license/` |
| OSS deploy | Engine source of truth: `packages/deploy/src/cli.ts` (+ helpers) |
| EE deploy | Thin entry forces enterprise edition; depends on `@envsync-cloud/deploy` |
| Boundary CI | Fails relative api piggyback in enterprise; fails OSS→EE deploy edge |

## Explicitly NOT done (P1+)

- EE `@/*` tsconfig still maps to `envsync-api/src` (services use core DB/helpers)
- Management routes/controllers still live in `envsync-api`
- Management-api still ~110 LOC process shell
- `envsync-ui` still tokens-only

## Verify

```sh
bun run check:boundaries
bun run --filter @envsync-cloud/deploy build && bun run --filter @envsync-cloud/deploy test
bun run --filter @envsync-cloud/deploy-enterprise build && bun run --filter @envsync-cloud/deploy-enterprise test
cd packages/envsync-management-api && bun run build
```
