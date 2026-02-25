# EnvSync Monorepo

> **Note:** This project was recently migrated to a **monorepo** for a better development experience. All core packages, apps, and SDKs now live in this repository.

---

## What is EnvSync?

EnvSync keeps your `.env` files, configuration secrets, and environment variables synchronized across development, staging, and production environments.

**Key benefits:**

- **Secure** – End-to-end encryption for sensitive data  
- **Fast** – Real-time synchronization across environments  
- **Web-first** – Built for modern web development workflows  
- **Developer-friendly** – REST API, CLI, and web dashboard  

---

## Install

From the **repository root**:

```bash
bun install
```

---

## Environment

All environment variables are read from the **root `.env`** file. No per-package `.env` is required.

1. Copy the example and edit:

   ```bash
   cp .env.example .env
   ```

2. Fill in values in the root `.env`. This file is used by:
   - **envsync-api** (Bun) when running `dev` / `start` / scripts  
   - **envsync-web** and **envsync-landing** (Vite) via `envDir` pointing at the repo root  
   - **Docker Compose** via `env_file: .env` for services  

When you run from the root (e.g. `bun run dev`, `bun run cli init`), or when Turbo runs package tasks, the API and Vite apps load `.env` from the monorepo root.

---

## Run

```bash
# Development (all packages via Turbo)
bun run dev

# Full init: creates .env from .env.example, starts Docker services
# (keycloak, spacetimedb, redis, rustfs, mailpit), waits for
# Keycloak/SpacetimeDB/RustFS, creates RustFS bucket, retrieves
# Keycloak client secrets and writes them to .env.
bun run cli init
```

After `bun run cli init`, start the API with `bun run dev` or `docker compose up -d envsync_api`.

---

## Root scripts (`scripts/`)

The **`scripts/`** folder at the repo root provides a single entrypoint for environment setup and Docker.

| Command | Description |
|--------|-------------|
| `bun run cli init` | Full init: ensure `.env`, Docker up, wait for services, API init (RustFS bucket + Keycloak client secrets), then Docker down |
| `bun run cli services up` | Start Docker Compose services (keycloak, spacetimedb, redis, rustfs, mailpit) |
| `bun run cli services down` | Stop Docker Compose services |
| `bun run cli services status` | Show Docker Compose service status |

Usage:

```bash
bun run cli <command> [options]
```

The API package also exposes its own CLI for init/bucket/Keycloak from the API context:

```bash
# From monorepo root or packages/envsync-api
bun run packages/envsync-api/scripts/cli.ts init
```

---

## Monorepo layout

| Path | Contents |
|------|----------|
| **`packages/`** | Core libraries and services (API, CLI) |
| **`apps/`** | Web applications (dashboard, landing) |
| **`sdks/`** | Generated API clients (TypeScript, Go) |
| **`scripts/`** | Root-level CLI for init and Docker |

---

## Packages

### `packages/envsync-api`

REST API backend for EnvSync Cloud.

- **Stack:** Hono, Bun, TypeScript, SpacetimeDB, Redis, Keycloak (OIDC), S3-compatible (RustFS), Docker
- **Docs:** [api.envsync.cloud/docs](https://api.envsync.cloud/docs)
- **From root:** `bun run dev` (Turbo) or run from `packages/envsync-api`: `bun run dev`, `bun run scripts/cli.ts init`  

See **[packages/envsync-api/README.md](packages/envsync-api/README.md)** for API-specific setup, env vars, and structure.

### `packages/envsync-cli`

Command-line interface for syncing environment variables.

- **Stack:** Go, urfave/cli, Uber Zap  
- **Commands:** `login`, `whoami`, `logout`, `init`, `push`, `pull`, `app create/list/delete`, `env-type list/view`, `config set/get`, `run --command "..."`  
- **Config:** `envsyncrc.toml` (app_id, env_type_id); auth via API key or JWT (`envsync login`)  

See **[packages/envsync-cli/README.md](packages/envsync-cli/README.md)** for installation, usage, and development.

---

## Apps

### `apps/envsync-web`

Web dashboard for managing projects, environment types, variables, and secrets.

- **Stack:** React, Vite, TailwindCSS, React Query, Zod  
- **Env:** `VITE_API_BASE_URL` (or use root `.env`)  
- **Run:** `bun run dev` from root or `bun dev` in `apps/envsync-web`  

See **[apps/envsync-web/README.md](apps/envsync-web/README.md)** for details.

### `apps/envsync-landing`

Marketing/landing page for EnvSync Cloud.

- **Stack:** React, Vite, TailwindCSS  
- **Run:** `bun run dev` from root or `bun dev` in `apps/envsync-landing`  

See **[apps/envsync-landing/README.md](apps/envsync-landing/README.md)** for details.

---

## SDKs

### `sdks/envsync-ts-sdk`

Generated TypeScript SDK for the EnvSync API.

- Used by the web app and other Node/Bun/TS consumers.  
- See **[sdks/envsync-ts-sdk/README.md](sdks/envsync-ts-sdk/README.md)**.

### `sdks/envsync-go-sdk`

Generated Go SDK for the EnvSync API.

- **Usage:** See **[sdks/envsync-go-sdk/sdk/README.md](sdks/envsync-go-sdk/sdk/README.md)** for client setup, auth, retries, and timeouts.  
- Built with [Fern](https://buildwithfern.com); contributions to the README are welcome; code is generated.

---

## Keycloak

Keycloak provides OIDC authentication for EnvSync. Setup is fully automated:

- The **"envsync" realm** is auto-imported on first start via `--import-realm` in Docker Compose.
- Three OIDC clients are pre-configured: `envsync-web`, `envsync-api`, `envsync-cli`.
- The init script (`bun run cli init`) automatically retrieves client secrets from the Keycloak Admin API and writes them to `.env`.
- No PAT or manual configuration needed.

---

## Local Dev

1. Run `bun cli init` to initialize the project locally.
2. Run `bun cli services up` to start required docker services.
3. Finally, run `bun dev` to run EnvSync Local.

---

## Contributing

1. Fork the repository  
2. Create a feature branch (`git checkout -b feature/amazing-feature`)  
3. Commit your changes (`git commit -m 'Add amazing feature'`)  
4. Push to the branch (`git push origin feature/amazing-feature`)  
5. Open a Pull Request  

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## Support & community

- **Email:** hi@envsync.cloud  
- **Docs/Blog:** [docs.envsync.cloud](https://docs.envsync.cloud)  
- **Issues:** [GitHub Issues](https://github.com/EnvSync-Cloud/envsync-monorepo/issues)  

**Making environment configuration simple, secure, and synchronized.**

Built with ❤️ by the EnvSync team
