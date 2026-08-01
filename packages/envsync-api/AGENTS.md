# EnvSync API

Backend API for the EnvSync platform.

## Stack

- **Framework:** Hono on Bun runtime
- **Database:** PostgreSQL via Kysely (type-safe query builder, NOT an ORM)
- **Secrets:** miniKMS + RustFS-backed secret storage
- **Auth:** Keycloak OIDC (`openid-client`) + JWT verification (`jose`)
- **Authorization:** OpenFGA for fine-grained access control
- **Validation:** Zod schemas + `@hono/zod-validator`
- **API docs:** `zod-openapi` annotations, served at `/docs` via `@scalar/hono-api-reference`

## Architecture

**Single process.** Product routes mount at `/api/*`. When management is enabled and enterprise modules are registered, manage routes mount at `/api/v1/manage/{module}/...` on the same app. There is no `envsync-management-api` package.

```
src/
  entrypoint.ts              # OSS / local entry
  entrypoint.enterprise.ts   # EE image entry (registers enterprise modules first)
  app/factory.ts             # createApiApp — core + optional manage mount
  modules/load-modules.ts    # ModuleRegistry bags; tryRegisterEnterpriseManageModules
  routes/                    # core product routers
  controllers/               # request handlers
  services/                  # business logic (+ thin re-exports of some EE services)
  libs/                      # DB, miniKMS, Cache, OpenFGA, S3, Mail, OpenAPI helpers
  public/ports/              # stable imports for envsync-enterprise
  utils/env.ts               # Zod-validated env config
```

OpenAPI: `GET /openapi` (unique operationIds via `libs/openapi-disambiguate.ts`). Export for SDKs: `bun run scripts/export-openapi.ts`.

## Key libs

- **miniKMS:** `src/libs/kms/` — envelope encryption + key/session management
- **OpenFGA:** `src/libs/openfga/` — fine-grained authorization checks
- **DB:** `src/libs/db/` — Kysely instance and query helpers

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Hot-reload dev server |
| `bun run build` | Build via esbuild (`builder.ts`) to `dist/` |
| `bun run start` | Run production server |
| `bun run db migrate` | Run database migrations |
| `bun test tests/mock` | Unit tests |
| `bun run scripts/export-openapi.ts` | Unified OpenAPI for SDK codegen |
| `bun run builder.enterprise.ts` | Bundle EE entry for `docker/api-enterprise.Dockerfile` |

## CLI scripts

`scripts/cli.ts` provides setup commands (run from repo root with `bun run cli`):
- `init` — initialize RustFS bucket + Keycloak OIDC apps
- `create-dev-user --seed` — create dev user + sample data

## Conventions

- Path alias: `@/*` maps to `src/*`
- Env config: all env vars validated in `src/utils/env.ts` with Zod — add new vars there
- Route pattern: each domain (auth, org, secret, etc.) has its own route file in `src/routes/`
- Test files live in `tests/mock/` (unit) and `tests/e2e/` (integration)
