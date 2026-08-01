# No-piggyback P2 — ports + design system start

**Branch:** `feat/the-big-update-no-piggyback-p2`

## Delivered

| Item | Change |
|------|--------|
| Core ports | `envsync-api/ports` (+ `ports/*`) public re-exports for DB, errors, logger, env, middlewares, helpers, core services, validators |
| Enterprise imports | All former `@/…` deep imports rewritten to `envsync-api/ports/…` |
| Enterprise tsconfig | **Removed** `@/*` → `envsync-api/src` mapping |
| envsync-ui | Shared `cn`, `Button`, `Badge`, `Card`, `Input`; web re-exports for compat |
| Boundary CI | Fails if enterprise uses `@/` or maps `@/*` into api |

## Still open (P3+)

- Full shadcn surface still mostly in `envsync-web`
- `createApiApp` still core-owned
- Ports are still re-exports of api internals (honest package boundary, not full DI)

## Verify

```sh
bun run check:boundaries
bun run test:mock
cd packages/envsync-ui && bun test
cd packages/envsync-management-api && bun run build
```
