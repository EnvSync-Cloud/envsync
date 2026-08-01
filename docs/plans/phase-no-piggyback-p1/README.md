# No-piggyback P1 — management HTTP ownership

**Branch:** `feat/the-big-update-no-piggyback-p1`

## Delivered

| Item | Change |
|------|--------|
| EE routes | `enterprise`, `license`, `oidc`, `saml`, `rotation`, `dynamic_secret`, `log-forwarding` under `envsync-enterprise/src/routes` |
| EE controllers + validators | Same package (`src/controllers`, `src/validators`); license **status** schemas stay in core for system status |
| Module wiring | `enterpriseManagementModules` loads `./routes/*` (not `envsync-api/management-route-loaders` for EE) |
| Management process | `envsync-management-api/src/create-app.ts` + entrypoint uses local factory wrap |
| Core loaders | Only shared `onboarding` + `system` remain on `management-route-loaders` |

## Still piggybacking (P2+)

- EE code still uses `@/` for core middlewares, DB, helpers, audit services
- Shared `createApiApp` factory still lives in `envsync-api`
- `envsync-ui` still tokens-only

## Verify

```sh
bun run check:boundaries
cd packages/envsync-management-api && bun run build
bun run test:mock
# optional: management e2e subset
```
