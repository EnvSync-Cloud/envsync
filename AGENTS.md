# EnvSync Monorepo

Environment variable management platform — store, sync, and manage secrets across teams and environments.

## Monorepo structure

- `packages/envsync-api/` — Backend API (Hono + Bun)
- `packages/envsync-cli/` — CLI client (Go)
- `apps/envsync-web/` — Web dashboard (React + Vite)
- `apps/envsync-landing/` — Marketing landing page (React + Vite)
- `sdks/envsync-ts-sdk/` — TypeScript SDK (auto-generated)
- `sdks/envsync-go-sdk/` — Go SDK (auto-generated)

## Runtimes

- Bun 1.3+ (TS packages, package manager)
- Go 1.21+ (CLI)
- Node 18+ (compatibility)

## Package manager

Bun workspaces with Turbo for orchestration. All workspace packages defined in root `package.json`.

## Setup

```sh
bun install                          # install all dependencies
docker compose up -d                 # PostgreSQL, Redis, Vault, RustFS, Zitadel, Mailpit, OpenFGA
cp .env.example .env                 # configure env vars
bun run cli init                     # initialize RustFS bucket + Zitadel OIDC apps
bun run cli create-dev-user --seed   # create dev user + sample data
bun run dev                          # start all services via Turbo
```

## Key commands

| Command | Description |
|---------|-------------|
| `bun install` | Install all workspace dependencies |
| `bun run dev` | Start all services (Turbo) |
| `bun run build` | Build all packages (Turbo) |
| `bun run cli init` | Initialize RustFS + Zitadel |
| `bun run cli create-dev-user --seed` | Seed dev user + sample data |
| `bun run test:mock` | Run unit tests (mocked dependencies) |
| `bun run test:e2e` | Run e2e tests (requires running services) |

## Environment variables

Single `.env` file at the repo root. All TS packages read from it via the `load-root-env.ts` helper. Env vars are validated with Zod in `packages/envsync-api/src/utils/env.ts` — add new vars there.

## CI/CD

- `.github/workflows/ci.yaml` — build + mock tests + e2e tests
- `.github/workflows/deploy-fe.yaml` — frontend deployment
- `.github/workflows/release.yml` — release workflow

## Cross-cutting conventions

- Path alias `@/*` maps to `src/*` in all TS packages (configured in each `tsconfig.json`)
- SDKs in `sdks/` are auto-generated — do not hand-edit
- The TS SDK is consumed by `apps/envsync-web` via workspace link
