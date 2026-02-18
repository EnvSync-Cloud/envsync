# EnvSync API

Backend API for the EnvSync platform.

## Stack

- **Framework:** Hono on Bun runtime
- **Database:** PostgreSQL via Kysely (type-safe query builder, NOT an ORM)
- **Secrets:** HashiCorp Vault (KV v2)
- **Auth:** Zitadel OIDC (`openid-client`) + JWT verification (`jose`)
- **Authorization:** OpenFGA for fine-grained access control
- **Validation:** Zod schemas + `@hono/zod-validator`
- **API docs:** `zod-openapi` annotations, served at `/docs` via `@scalar/hono-api-reference`

## Architecture

```
src/
  entrypoint.ts          # app entry point
  routes/index.ts        # route registration (each domain has its own router)
  controllers/           # request handlers
  services/              # business logic
  libs/                  # integrations (DB, Vault, Cache, OpenFGA, S3, Mail, Webhooks)
  validators/            # Zod schemas for request validation
  middlewares/            # Hono middleware
  helpers/               # shared utilities
  types/                 # TypeScript types
  utils/env.ts           # Zod-validated env config — add new env vars here
  scripts/migrations/    # Kysely database migrations
```

## Key libs

- **Vault:** `src/libs/vault/index.ts` — singleton `VaultClient` with AppRole auth, auto-unseal, KV v2 operations. Paths in `src/libs/vault/paths.ts`
- **OpenFGA:** `src/libs/openfga/` — fine-grained authorization checks
- **DB:** `src/libs/db/` — Kysely instance and query helpers

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Hot-reload dev server |
| `bun run build` | Build via esbuild (`builder.ts`) to `dist/` |
| `bun run start` | Run production server |
| `bun run db migrate` | Run database migrations |
| `bun test tests/mock` | Unit tests (mocked Vault/DB) |
| `TEST_MODE=e2e bun test tests/e2e` | E2e tests (requires running services) |

## CLI scripts

`scripts/cli.ts` provides setup commands (run from repo root with `bun run cli`):
- `init` — initialize RustFS bucket + Zitadel OIDC apps
- `create-dev-user --seed` — create dev user + sample data

## Conventions

- Path alias: `@/*` maps to `src/*`
- Env config: all env vars validated in `src/utils/env.ts` with Zod — add new vars there
- Route pattern: each domain (auth, org, secret, etc.) has its own route file in `src/routes/`
- Test files live in `tests/mock/` (unit) and `tests/e2e/` (integration)
