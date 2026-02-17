# Contributing to EnvSync

## Prerequisites & Local Setup

See the [README](README.md) and per-package `AGENTS.md` files for full architecture details. Essentials:

- **Bun 1.3+**, **Go 1.21+**, **Docker**
- `bun install` — install all JS/TS dependencies
- `docker compose up -d` — start Postgres, Vault, OpenFGA, Zitadel, Mailpit
- `bun run cli init` — bootstrap Vault and OpenFGA
- `bun run cli create-dev-user --seed` — seed a development user

## Development Workflow

1. Fork the repo and create a branch from `main`
2. Branch naming: `feat/`, `fix/`, `chore/`, `docs/`
3. Keep PRs focused — one feature or fix per PR
4. Push and open a PR against `main`

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

### Adding a new endpoint — checklist

1. Zod validator in `src/validators/{resource}.validator.ts` (include `.openapi()` annotations)
2. Service method in `src/services/{resource}.service.ts` (static methods, Kysely queries)
3. Controller in `src/controllers/{resource}.controller.ts` (delegates to service, handles errors, logs audit)
4. Route in `src/routes/{resource}.route.ts` (use `describeRoute`, `zValidator`, permission middleware)
5. Register the route in `src/routes/index.ts`
6. Add mock test + E2E test (as above)

### Other conventions

- **File naming:** `{resource}.controller.ts`, `{resource}.service.ts`, `{resource}.route.ts`, `{resource}.validator.ts`
- **New env vars:** add to the Zod schema in `src/utils/env.ts`
- **Database changes:** add a Kysely migration in `src/scripts/migrations/`, run with `bun run db migrate`
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
- Run `bun run lint` before pushing

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
| **test-e2e** | Full integration tests with Postgres, Vault, OpenFGA, Zitadel, Mailpit |

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
