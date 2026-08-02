# Contributing to EnvSync

## Prerequisites & Local Setup

See the [README](README.md) and per-package `AGENTS.md` files for full architecture details. Essentials:

- **Bun 1.3+**, **Go 1.24+**, **Docker**
- `bun install` — install all JS/TS dependencies
- `docker compose up -d` — start Postgres, miniKMS, OpenFGA, Keycloak, Mailpit
- Keycloak is built locally from `packages/envsync-keycloak-theme`; no GHCR auth is required for local auth/E2E
- `bun run cli:init` — bootstrap RustFS and Keycloak clients
- `bun run cli create-dev-user --seed` — seed a development user

## Development Workflow

1. Fork the repo and create a branch from `main` (or from the active program track branch when working on the no-piggyback rollout — see below)
2. Branch naming: `feat/`, `fix/`, `chore/`, `docs/`
3. Keep PRs focused — one feature or fix per PR
4. Push and open a PR against `main` (or the program track branch when directed)
5. Use the [PR template](./.github/PULL_REQUEST_TEMPLATE.md) no-piggyback + org-create channel checks

### No-piggyback program (active)

When working on tenancy, deploy CLI split, manage surface, licensing, or FE edition isolation:

- Track: `feat/the-big-update` (phase branches as needed)
- Product matrix: [EDITIONING.md](./EDITIONING.md), deploy all editions: [DEPLOY.md](./DEPLOY.md), root [AGENTS.md](./AGENTS.md)
- Local planning notes may live under `docs/` (gitignored — not required for OSS clone)

### Deployment mode & edition footguns

Local defaults favor Hosted-like development. That is intentional — and easy to misread as production self-host config.

| Variable | Default / missing behavior | Footgun |
|----------|----------------------------|---------|
| `ENVSYNC_EDITION` | Defaults to **`enterprise`** in `env.ts` | An “OSS” mental model still loads enterprise edition flags unless you set `ENVSYNC_EDITION=oss`. |
| `ENVSYNC_DEPLOYMENT_MODE` | **Optional.** If unset: OSS → `selfhosted`; enterprise → **`hosted`** | Self-host **enterprise** installs that omit the var behave as **Hosted** (multi-org SaaS policy, license bypass for multi-org). **Always set `ENVSYNC_DEPLOYMENT_MODE=selfhosted` for self-host.** |
| Hosted FE build | CF `deploy-fe` must use **`build:hosted`** | Never point Hosted Cloudflare at `build:oss` — EE dashboard modules will be empty stubs. |
| Org create API | `POST /auth/create-organization` only | Do not reintroduce `/auth/create-workspace`. |

Self-host checklist:

```bash
ENVSYNC_DEPLOYMENT_MODE=selfhosted
ENVSYNC_EDITION=oss          # or enterprise for licensed EE
# EE self-host also needs entitlement verify + setup token / deploy CLI for org create
```

See [EDITIONING.md](./EDITIONING.md) and [SELFHOSTING.md](./SELFHOSTING.md) (enterprise license install notes for self-host).

## API / Backend Changes (`packages/envsync-api/`)

### Testing requirements

Every API change must include:

- **Mock test** in `tests/mock/{feature}.test.ts` (unit-level, mocked Vault/DB/FGA)
- **E2E test** in `tests/e2e/flows/{feature}.e2e.test.ts` (real services via Docker)

Run both suites locally before pushing:

```bash
bun run test:mock
bun run test:e2e
```

Use `bun run test:e2e` from the repo root. It runs `e2e-setup init` before invoking the package E2E suite.

### Adding a new endpoint — checklist

1. Zod validator in `src/validators/{resource}.validator.ts` (include `.openapi()` annotations)
2. Service method in `src/services/{resource}.service.ts` (static methods, Kysely queries)
3. Controller in `src/controllers/{resource}.controller.ts` (delegates to service, handles errors, logs audit)
4. Route in `src/routes/{resource}.route.ts` (use `describeRoute`, `zValidator`, permission middleware)
5. Register the route in `src/modules/core-modules.ts`
6. Add mock test + E2E test (as above)

### Other conventions

- **File naming:** `{resource}.controller.ts`, `{resource}.service.ts`, `{resource}.route.ts`, `{resource}.validator.ts`
- **New env vars:** add to the base Zod schema in `src/utils/env.ts` or to a module env extension
- **Database changes:** add a Kysely migration in `src/libs/db/migrations/`, run with `bun run db`
- **Formatting:** `prettier --write .` (uses `@bravo68web/prettier-config`)

## Frontend Changes (`apps/envsync-web/`)

### Folder structure

| Location | Convention | Example |
|----------|-----------|---------|
| `src/pages/` | PascalCase directory per feature | `Applications/` |
| `src/components/{feature}/` | PascalCase files | `AppCard.tsx` |
| `src/components/ui/` | kebab-case (shadcn — don't hand-edit) | `button.tsx` |
| `src/api/` | React Query hooks | `{resource}.api.ts` |
| `src/hooks/` | Custom React hooks | `useDebounce.ts` |
| `src/contexts/` | Context providers | `AuthContext.tsx` |

### Conventions

- Use `@envsync-cloud/envsync-ts-sdk` for API types — don't duplicate types locally
- Server state via **React Query**, client state via **React Context**
- Only `VITE_*` env vars are exposed to the client
- Register new dashboard routes and nav items via `src/modules/core-modules.ts`
- Run `bun run lint` before pushing

## Editions & dual license

EnvSync is a **public dual-license monorepo** (not private-superset-only). See:

- [LICENSE](./LICENSE) — MIT default + proprietary carve-out  
- [EDITIONING.md](./EDITIONING.md) — product matrix and package graph  
- [SELFHOSTING.md](./SELFHOSTING.md) — self-host deploy / org bootstrap  

### Proprietary paths

Code under `packages/envsync-enterprise`, `packages/envsync-enterprise-web`,
`packages/envsync-enterprise` / `envsync-enterprise-web`, and `packages/deploy-cli` (enterprise deploy)
is **proprietary**. By contributing to those paths you grant EnvSync Cloud the
right to use, modify, and distribute your contribution under the EnvSync
Enterprise License (and to relicense as needed for the product).

MIT-path contributions remain under MIT.

### Guardrails for contributors

- Do not add proprietary packages as **production** dependencies of MIT packages
  (CI: `bun run check:boundaries`). `envsync-enterprise-web` is a **devDependency**
  of `envsync-web` (Vite resolves it only for enterprise/hosted builds).
- Do not reintroduce `apps/envsync-management-web`, `envsync-management-api`, or `sdks/envsync-management-*`.
- Do not reintroduce monorepo spawn shims for OSS deploy.
- Prefer **Organization** in user-facing copy; org create API is
  `POST /auth/create-organization` only.
- Self-host multi-org limits come from **entitlement claims**; do not rely on
  bare `ENVSYNC_MAX_ORGS` (support override only).
- Shared extension seams live in API/web module loaders; keep core shells free of EE imports.
- Shared design tokens live in MIT `envsync-ui` — do not fork `:root` / `.dark` blocks in apps.

## CLI Changes (`packages/envsync-cli/`)

### Adding a new command — layered architecture

1. Command definition in `internal/features/commands/{feature}_commands.go`
2. Action handler in `internal/actions/{domain}.go`
3. Service logic in `internal/services/{domain}.go` (interface + implementation)
4. Repository (API client) in `internal/repository/` if new API calls are needed
5. Domain models in `internal/domain/` if new types are needed
6. Presentation formatting in `internal/presentation/` if new table output is needed

### Conventions

- All internal packages live under `internal/` (unexported by Go convention)
- File naming: snake_case (`{feature}_commands.go`, `{domain}.go`)
- Run `make lint` (golangci-lint) and `make tidy` before pushing

## SDKs (`sdks/`)

SDKs are **auto-generated** — do NOT edit files in `sdks/envsync-ts-sdk/src/` or `sdks/envsync-go-sdk/sdk/`.

To update SDKs after API changes:

- **TypeScript:** `bun run generate:local`
- **Go:** `./generator.sh`

## CI Checks

All PRs must pass these GitHub Actions jobs (`.github/workflows/ci.yaml`):

| Job | What it runs |
|-----|-------------|
| **build** | `bun run build` (all packages) |
| **test-mock** | Mock/unit tests against a Postgres service container |
| **test-e2e** | Full integration tests with Postgres, miniKMS, OpenFGA, Keycloak, Mailpit |

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add webhook retry logic
fix: correct env variable decryption on rollback
chore: bump dependencies
docs: update CLI usage examples
refactor: extract permission checks into middleware
test: add e2e coverage for team invitations
```

Keep the subject line under 72 characters.
