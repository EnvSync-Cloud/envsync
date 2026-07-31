# EnvSync Monorepo

Environment variable management platform — store, sync, and manage secrets across teams and environments.

## Active program: no-piggyback rollout

- **Track branch:** `feat/the-big-update` (phase branches: `feat/the-big-update-p0`, `p1`, …)
- **Plan:** [docs/plans/2026-08-no-piggyback-program.md](./docs/plans/2026-08-no-piggyback-program.md)
- **ADR:** [docs/adr/0001-no-piggyback-program.md](./docs/adr/0001-no-piggyback-program.md)
- **Phase 0 exit package:** [docs/plans/phase-0/README.md](./docs/plans/phase-0/README.md)

Do not reintroduce product piggybacks (OSS deploy spawning enterprise CLI, management API as core re-export, self-host web org-create, landing required on self-host). See PR template checklist.

**Dual license:** [LICENSE](./LICENSE) · **Editions:** [EDITIONING.md](./EDITIONING.md) · **Support matrix:** [docs/SUPPORT.md](./docs/SUPPORT.md)  
Prefer **Organization** in product UI; `POST /auth/create-workspace` is a deprecated alias of `create-organization`.

## Monorepo structure

- `packages/envsync-api/` — Backend API (Hono + Bun)
- `packages/envsync-cli/` — CLI client (Go)
- `packages/envsync-kernel/` — Shared MIT kernel (errors, ApiModule types)
- `packages/envsync-enterprise/` — Proprietary management module registry + EE surface
- `packages/envsync-enterprise-web/` — Proprietary dashboard WebModule[] + integrations pages (injected into envsync-web)
- `packages/envsync-management-api/` — Enterprise management API process (depends on enterprise + api, not relative core src)
- `packages/envsync-keycloak-theme/` — Custom Keycloak login theme (Docker-bundled)
- `packages/deploy/` — Public OSS deploy CLI (`@envsync-cloud/deploy`, bin `envsync-deploy`)
- `packages/deploy-cli/` — Enterprise deploy sources → published as private `@envsync-cloud/deploy-enterprise` (`envsync-deploy-enterprise`)
- `packages/deploy-core/` — Shared deployment primitives (TypeScript)
- `apps/envsync-web/` — Web dashboard (React + Vite)
- `apps/envsync-landing/` — Marketing landing page (React + Vite)
- `sdks/envsync-ts-sdk/` — TypeScript SDK (auto-generated)
- `sdks/envsync-go-sdk/` — Go SDK (auto-generated)
- `sdks/envsync-management-ts-sdk/` — Management API TypeScript SDK (auto-generated)
- `sdks/envsync-management-go-sdk/` — Management API Go SDK (auto-generated)

## Runtimes

- Bun 1.3+ (TS packages, package manager)
- Go 1.24+ (CLI)
- Node 18+ (compatibility)

## Package manager

Bun workspaces with Turbo for orchestration. All workspace packages defined in root `package.json`.

## Setup

```sh
bun install                          # install all dependencies
docker compose up -d                 # PostgreSQL, Redis, miniKMS, RustFS, Keycloak, Mailpit, OpenFGA
cp .env.example .env                 # configure env vars
bun run cli init                     # initialize RustFS bucket + Keycloak clients
bun run cli create-dev-user --seed   # create dev user + sample data
bun run dev                          # start all services via Turbo
```

## Key commands

| Command | Description |
|---------|-------------|
| `bun install` | Install all workspace dependencies |
| `bun run dev` | Start all services (Turbo) |
| `bun run build` | Build all packages (Turbo) |
| `bun run cli init` | Initialize RustFS + Keycloak |
| `bun run cli create-dev-user --seed` | Seed dev user + sample data |
| `bun run test:mock` | Run unit tests (mocked dependencies) |
| `bun run test:e2e` | Run e2e tests from the repo root (runs `e2e-setup init` first) |

License E2E note:
- Hosted enterprise license checks live in `packages/envsync-api/tests/e2e/flows/enterprise-license-lock.e2e.test.ts`.
- CI requires `ENVSYNC_E2E_LICENSE_KEY` and calls `https://license.envsync.cloud`; do not reintroduce local license-server skips for public CI.

UI E2E note:
- GitHub CI should prepare UI E2E with `bun run e2e-setup reset`, not plain `init`.
- The UI harness seeds a dedicated org through `bun run packages/envsync-api/scripts/cli.ts bootstrap-ui-harness --org-slug ... --org-name ...`.
- Local reproduction should use the merged E2E env (`.env.ui-e2e` style layering), not only the root `.env`.
- CI runs UI regression with `ENVSYNC_UI_REQUIRE_FRESH_LOGIN=1` and `ENVSYNC_UI_WORKERS=1` for determinism.

## Environment variables

Single `.env` file at the repo root. All TS packages read from it via the `load-root-env.ts` helper. Env vars are validated with Zod in `packages/envsync-api/src/utils/env.ts` — add new vars there.

## CI/CD

- `.github/workflows/ci.yaml` — build + mock tests + e2e tests
- `.github/workflows/deploy-fe.yaml` — frontend deployment
- `.github/workflows/release.yml` — release workflow
- `.github/workflows/scan.yaml` — SonarQube static analysis (push to main)

## Cross-cutting conventions

- Path alias `@/*` maps to `src/*` in all TS packages (configured in each `tsconfig.json`)
- SDKs in `sdks/` are auto-generated — do not hand-edit
- The TS SDK is consumed by `apps/envsync-web` via workspace link

## Init

Current local bootstrap from scratch is now:

```
cp .env.example .env
bun install
bun run cli init
bun run clickstack:sync
bun run dev
```

Keycloak is built locally from `packages/envsync-keycloak-theme` for dev and E2E. It is not pulled from GHCR in those flows.

For the sim test after local is up:
```
cd packages/envsync-api
bun run scripts/sim.ts
```

Useful variants:
```
SIM_WORKERS=50 bun run scripts/sim.ts
SIM_WORKERS=200 SIM_DELAY_MS=0 bun run scripts/sim.ts
```
