# EnvSync Monorepo

EnvSync is an environment variable and secrets management platform with:
- a Bun API
- a Go CLI
- a React dashboard
- generated SDKs

## What Changed

The repo now uses:
- Keycloak instead of Zitadel
- ClickStack / HyperDX instead of the old Grafana/Loki/Tempo stack
- miniKMS for secret storage flows
- a local bootstrap flow that seeds ClickStack sources and dashboards automatically
- a locally built Keycloak image from `packages/envsync-keycloak-theme` for dev and E2E

## Monorepo Layout

| Path | Purpose |
|------|---------|
| `packages/envsync-api` | Bun + Hono API |
| `packages/envsync-cli` | Go CLI |
| `apps/envsync-web` | React dashboard |
| `apps/envsync-landing` | Landing page |
| `packages/deploy-cli` | self-hosted deployment CLI |
| `packages/envsync-keycloak-theme` | custom Keycloak theme |
| `sdks/` | generated TypeScript and Go SDKs |
| `scripts/` | local bootstrap and helper scripts |

## Local Development

Use this from the repo root:

```bash
cp .env.example .env
bun install
docker compose up -d
bun run cli:init
bun run cli:create-dev-user --seed
bun run clickstack:sync
bun run dev
```

If you previously tried local auth on `localhost`, clear browser site data for both `localhost` and `*.lvh.me` before retrying login on `app.lvh.me`.

What that does:
- creates local `.env` from `.env.example`
- starts local infra with Docker Compose
- runs DB migrations
- bootstraps RustFS and Keycloak clients
- builds the local Keycloak image from repo source when needed
- seeds a local dev user, org, apps, envs, secrets, and sample data
- seeds local ClickStack / HyperDX sources and dashboards
- starts the apps with Turbo

`lvh.me` is a wildcard hostname that resolves to `127.0.0.1`, so `app.lvh.me`, `auth.lvh.me`, and `api.lvh.me` all point to your machine without editing `/etc/hosts`.

Use `lvh.me` for browser-facing local auth. `localhost` is not the supported browser login path because Keycloak 26 treats `localhost` as a secure context and can break local auth cookies.

## Local Services

Main local endpoints:

| Service | URL |
|---------|-----|
| Dashboard | `http://app.lvh.me:8001` |
| API | `http://api.lvh.me:4000` |
| Keycloak | `http://auth.lvh.me:8080` |
| ClickStack / HyperDX | `http://localhost:8800` |
| Mailpit | `http://localhost:8025` |
| RustFS S3 API | `http://localhost:19000` |
| RustFS Console | `http://localhost:19001` |
| OpenFGA | `http://localhost:8090` |

## Local HyperDX Login

For local dev, `bun run clickstack:sync` seeds a default HyperDX user and dashboards.

UI login:
- email: `local-operator@envsync.local`
- password: `EnvsyncLocal!123`

Notes:
- the script also writes `.env.local` for the frontend telemetry config
- rerun `bun run clickstack:sync` after recreating the ClickStack container or volumes

## Root Commands

| Command | Description |
|--------|-------------|
| `bun run dev` | run API, web, and landing locally via Turbo |
| `bun run build` | build the workspace |
| `bun run cli:init` | local infra bootstrap, migrations, RustFS bucket, Keycloak client setup |
| `bun run cli:create-dev-user --seed` | create the local dev user and seed sample data |
| `bun run cli services up` | start Docker Compose services |
| `bun run cli services down` | stop Docker Compose services |
| `bun run cli services status` | inspect Docker Compose services |
| `bun run clickstack:sync` | sync local ClickStack OTLP config and seed sources/dashboards |
| `bun run clickstack:bootstrap` | reseed local ClickStack dashboards only |
| `bun run test:mock` | run mock tests |
| `bun run test:e2e` | run E2E tests from the repo root; it runs `e2e-setup init` first |

## Sim Test

Run the API simulation load test from the API package:

```bash
cd packages/envsync-api
bun run scripts/sim.ts
```

Useful variants:

```bash
SIM_WORKERS=50 bun run scripts/sim.ts
SIM_WORKERS=200 SIM_DELAY_MS=0 bun run scripts/sim.ts
```

## Auth

Keycloak is the only supported identity provider in the current stack.

Canonical local browser auth flow:
- app: `http://app.lvh.me:8001`
- api callback: `http://api.lvh.me:4000/api/access/web/callback`
- auth: `http://auth.lvh.me:8080`

Canonical local env vars:
- `KEYCLOAK_URL`
- `KEYCLOAK_REALM`
- `KEYCLOAK_ADMIN_USER`
- `KEYCLOAK_ADMIN_PASSWORD`
- `KEYCLOAK_WEB_CLIENT_ID`
- `KEYCLOAK_WEB_CLIENT_SECRET`
- `KEYCLOAK_CLI_CLIENT_ID`
- `KEYCLOAK_API_CLIENT_ID`
- `KEYCLOAK_API_CLIENT_SECRET`

The local realm import lives under [docker/keycloak/realm-import](./docker/keycloak/realm-import). Self-hosted deploys generate a derived realm config during setup.
The local and E2E Keycloak container image is built from [packages/envsync-keycloak-theme](./packages/envsync-keycloak-theme), not pulled from GHCR.

## Observability

Local observability is ClickStack / HyperDX plus one OTEL collector:
- API, CLI, and browser telemetry flow into OTLP
- ClickStack stores traces, logs, and metrics
- local dashboards are seeded automatically

If you recreate ClickStack state:

```bash
bun run clickstack:sync
```

## Self-Hosting

Self-hosted deployment now targets:
- Docker Swarm
- Traefik
- Keycloak
- ClickStack / HyperDX
- single-host Ubuntu/Debian in v1

See [SELFHOSTING.md](./SELFHOSTING.md).

## SDKs

- [sdks/envsync-ts-sdk/README.md](./sdks/envsync-ts-sdk/README.md)
- [sdks/envsync-go-sdk/sdk/README.md](./sdks/envsync-go-sdk/sdk/README.md)

## Contributing

1. Create a branch.
2. Make changes.
3. Run relevant tests.
4. Open a PR.

## Support

- Docs: [docs.envsync.cloud](https://docs.envsync.cloud)
- Issues: [GitHub Issues](https://github.com/EnvSync-Cloud/envsync/issues)
