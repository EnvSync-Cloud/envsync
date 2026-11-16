# EnvSync API

The EnvSync API is the Bun + Hono backend in the monorepo. It handles auth, orgs, apps, envs, secrets, certificates, audit events, and CLI-facing workflows.

**One process:** product API at `/api/*`. Enterprise manage modules (when enabled) mount at `/api/v1/manage/{module}/...` on the same server — license, integrations, rotation, OIDC/SAML, dynamic secrets, log forwarding. OSS images do not ship those modules.

- OpenAPI: `http://api.lvh.me:4000/openapi` · docs UI: `/docs`
- EE production image: monorepo `docker/api-enterprise.Dockerfile` (bundles `envsync-enterprise`)
- Agents / structure: [AGENTS.md](./AGENTS.md)

## Local Development

All local env is managed from the monorepo root.

From the monorepo root:

```bash
cp .env.example .env
bun install
docker compose up -d
bun run cli:init
bun run cli:create-dev-user --seed
bun run clickstack:sync
bun run dev
```

If you previously attempted login on `localhost`, clear browser site data for both `localhost` and `*.lvh.me` before retrying the browser flow on `app.lvh.me`.

`lvh.me` resolves to `127.0.0.1`, so `app.lvh.me`, `auth.lvh.me`, and `api.lvh.me` all point to your machine without editing `/etc/hosts`.

Use these canonical local browser-facing URLs:
- dashboard: `http://app.lvh.me:8001`
- API: `http://api.lvh.me:4000`
- Atrium: `http://auth.lvh.me:8080`

Do not use `localhost` for browser login flows. Atrium issues the session cookie on the auth host, and a `localhost` login does not line up with `app.lvh.me`.

## Atrium local env

Canonical local auth config is the `ATRIUM_*` block in the repo root `.env.example`. The issuer is `http://auth.lvh.me:8080` with no realm path.

The web auth flow is intentionally API-first:
- Atrium redirects to the API callback on `api.lvh.me:4000`
- the API exchanges the code and redirects the browser to `app.lvh.me:8001/auth/callback#access_token=...`

## Scripts

From the monorepo root:

```bash
bun run cli:init
bun run cli:create-dev-user --seed
bun run test:mock
bun run test:e2e
```

From `packages/envsync-api`:

```bash
bun run test:mock
bun run test:e2e
bun run sim
```

## E2E

The automated E2E suite is API + CLI focused. It does not automate the browser login flow in this pass.

From the monorepo root:

```bash
bun run e2e-setup init
bun run test:e2e
```

Or from `packages/envsync-api`:

```bash
bun run e2e:init
bun run test:e2e
```

## Observability

Local observability uses ClickStack / HyperDX:
- UI: `http://localhost:8800`
- rerun `bun run clickstack:sync` after recreating ClickStack state

## Related Paths

- [docker-compose.yaml](../../docker-compose.yaml)
- [packages/envsync-api/src/controllers/access.controller.ts](./src/controllers/access.controller.ts)
- [packages/envsync-api/src/helpers/identity.ts](./src/helpers/identity.ts)
- [packages/envsync-api/tests/e2e/helpers/bootstrap-env.ts](./tests/e2e/helpers/bootstrap-env.ts)
