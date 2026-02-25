# EnvSync API

Backend API for the EnvSync platform.

## Stack

- **Framework:** Hono on Bun runtime
- **Database + Secrets + Authorization:** SpacetimeDB (all data, encryption, and fine-grained authorization in one service)
- **Auth:** Keycloak 26.x OIDC (`openid-client`) + JWT verification (`jose`)
- **Validation:** Zod schemas + `@hono/zod-validator`
- **API docs:** `zod-openapi` annotations, served at `/docs` via `@scalar/hono-api-reference`

## Architecture

```
src/
  entrypoint.ts          # app entry point
  routes/index.ts        # route registration (each domain has its own router)
  controllers/           # request handlers
  services/              # business logic
  libs/                  # integrations (STDB, Cache, S3, Mail, Webhooks)
  validators/            # Zod schemas for request validation
  middlewares/            # Hono middleware
  helpers/               # shared utilities
  types/                 # TypeScript types
  utils/env.ts           # Zod-validated env config — add new env vars here
  helpers/               # shared utilities (keycloak.ts, jwt.ts)
```

## Key libs

- **STDB:** `src/libs/stdb/` — SpacetimeDB client (singleton, SQL queries + reducer calls for all data, encryption, and authorization)
- **Keycloak:** `src/helpers/keycloak.ts` — admin token management, user CRUD, token exchange

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Hot-reload dev server |
| `bun run build` | Build via esbuild (`builder.ts`) to `dist/` |
| `bun run start` | Run production server |
| `bun test tests/mock` | Unit tests (mocked STDB/Keycloak) |
| `TEST_MODE=e2e bun test tests/e2e` | E2e tests (requires running services) |

## CLI scripts

`scripts/cli.ts` provides setup commands (run from repo root with `bun run cli`):
- `init` — initialize RustFS bucket + retrieve Keycloak client secrets
- `create-dev-user --seed` — create dev user + sample data

## Conventions

- Path alias: `@/*` maps to `src/*`
- Env config: all env vars validated in `src/utils/env.ts` with Zod — add new vars there
- Route pattern: each domain (auth, org, secret, etc.) has its own route file in `src/routes/`
- Test files live in `tests/mock/` (unit) and `tests/e2e/` (integration)
