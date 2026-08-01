# EnvSync Monorepo

Environment variable management platform — store, sync, and manage secrets across teams and environments.

## Active program: no-piggyback + unified manage API

- **Track branch:** `feat/the-big-update` (and phase branches)
- **Local-only notes:** `docs/` is gitignored (planning/ADRs/support matrix stay on disk for operators; not in git)

Do **not** reintroduce:

- Separate `envsync-management-api` process or `manage-api.*` host
- Separate `sdks/envsync-management-*` packages (clients use core SDKs only)
- OSS deploy spawning enterprise CLI; self-host web org-create; landing required on self-host

**Dual license:** [LICENSE](./LICENSE) · **Editions:** [EDITIONING.md](./EDITIONING.md) · **Self-host:** [SELFHOSTING.md](./SELFHOSTING.md)  
Prefer **Organization** in product UI; org create is `POST /auth/create-organization` only.

## Architecture facts (current)

| Fact | Detail |
|------|--------|
| API processes | **One** (`envsync-api`); product at `/api/*` |
| Manage surface | `/api/v1/manage/{module}/...` on the **same** process when EE modules load |
| EE image | `docker/api-enterprise.Dockerfile` → `envsync-api-enterprise` (bundles enterprise) |
| OpenAPI | Single doc at `/openapi` (+ `/docs`); enterprise tags marked in spec |
| TS SDK | `@envsync-cloud/envsync-ts-sdk` only — `BASE` = API origin |
| Go SDK | `sdks/envsync-go-sdk` only — same base URL for product + manage |
| Dashboard EE | `envsync-enterprise-web` injected into `envsync-web` (no management SPA) |

## Monorepo structure

- `packages/envsync-api/` — Backend API (Hono + Bun); mounts manage when EE enabled
- `packages/envsync-cli/` — CLI client (Go); single go-sdk client for product + manage
- `packages/envsync-ui/` — Shared MIT design tokens + Tailwind preset
- `packages/envsync-kernel/` — Shared MIT kernel (errors, `ApiModule`, registry)
- `packages/envsync-enterprise/` — Proprietary EE modules/routes/services
- `packages/envsync-enterprise-web/` — Proprietary dashboard modules (injected into web)
- `packages/envsync-keycloak-theme/` — Custom Keycloak login theme
- `packages/deploy/` — Public OSS deploy CLI (`@envsync-cloud/deploy`)
- `packages/deploy-cli/` — Thin EE entry → `@envsync-cloud/deploy-enterprise` (private)
- `packages/deploy-core/` — Shared deployment primitives
- `apps/envsync-web/` — Web dashboard shell (React + Vite)
- `apps/envsync-landing/` — Marketing landing (Hosted)
- `sdks/envsync-ts-sdk/` — Generated TS SDK (core + manage)
- `sdks/envsync-go-sdk/` — Generated Go SDK (core + manage)

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
- SDKs in `sdks/` are auto-generated — do not hand-edit; regenerate via `sdks/envsync-ts-sdk` `generate:local` / Go Fern (see [sdks/AGENTS.md](./sdks/AGENTS.md))
- Web + enterprise-web consume **only** `@envsync-cloud/envsync-ts-sdk`
- CLI consumes **only** `sdks/envsync-go-sdk`
- Boundary CI: `bun run check:boundaries`

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
