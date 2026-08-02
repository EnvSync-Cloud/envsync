<p align="center">
  <img src="apps/envsync-landing/public/EnvSync.svg" alt="EnvSync Logo" width="120" height="120" />
</p>

<h1 align="center">EnvSync</h1>

<p align="center">
  <strong>Ship environment variables without the drift.</strong>
</p>

<p align="center">
  CLI-first secrets and config delivery for dev, staging, CI, and production.
</p>

<p align="center">
  <a href="https://github.com/EnvSync-Cloud/envsync/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/EnvSync-Cloud/envsync/ci.yaml?branch=main&label=CI" alt="CI Status" />
  </a>
  <a href="https://github.com/EnvSync-Cloud/envsync/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/EnvSync-Cloud/envsync" alt="License" />
  </a>
  <a href="https://github.com/EnvSync-Cloud/envsync/releases">
    <img src="https://img.shields.io/github/v/release/EnvSync-Cloud/envsync" alt="Version" />
  </a>
  <a href="https://github.com/EnvSync-Cloud/envsync/stargazers">
    <img src="https://img.shields.io/github/stars/EnvSync-Cloud/envsync" alt="Stars" />
  </a>
</p>

---

## Why EnvSync?

**The problem:** `.env` files are the #1 source of credential leaks. Teams share secrets via Slack DMs, email threads, and Google Docs. Each copy is a potential breach.

**The solution:** EnvSync provides a single source of truth for environment variables and secrets, with:
- 🔄 **Point-in-time rollback** — Undo any secret change to any previous state
- ✅ **Approval workflows** — Require review before production changes
- 🔐 **End-to-end encryption** — AES-256 at rest, TLS in transit
- 🚀 **CLI-first workflow** — `envsync pull` and `envsync push` in your terminal
- 🌐 **28+ integrations** — GitHub, GitLab, Vercel, AWS, and more

---

## Quick Start

```bash
# Install CLI
curl -fsSL https://cli.envsync.cloud/install.sh | sh

# Login
envsync auth login

# Pull secrets
envsync pull --env development

# Push changes
envsync push --env staging
```

---

## Architecture

**One API process** serves both product routes (`/api/...`) and, when Enterprise modules are enabled, manage routes (`/api/v1/manage/{module}/...`). There is no separate management API process or management SDK package.

```
┌──────────────────────────────────────────────────────────────┐
│                    EnvSync Platform                          │
├──────────────────────────────────────────────────────────────┤
│  🖥️  Dashboard    │  ⌨️  CLI       │  📦 SDKs (TS + Go)      │
│  (React + Vite)   │  (Go)          │  core + manage paths    │
└─────────┬─────────┴───────┬────────┴──────────┬──────────────┘
          │                 │                   │
          ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│              Single API process (Bun + Hono)                │
│         /api/*  ·  /api/v1/manage/* (Enterprise)            │
├─────────────────────────────────────────────────────────────┤
│  🔐 Secrets    │  🔄 Rotation  │  🌐 Integrations          │
│  📋 Variables  │  ⏰ Dynamic   │  📊 Audit Logs            │
│  🔑 OIDC/SAML  │  📤 Log Fwd   │  🪝 Webhooks              │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

### Core
| Feature | Description |
|---------|-------------|
| 🔐 **Secrets Management** | Store, sync, and manage secrets across teams |
| 📋 **Environment Variables** | Version-controlled config with rollback |
| 👥 **Team Management** | Users, teams, roles, and permissions |
| 📊 **Audit Logs** | Track every change with full history |
| 🔄 **Change Requests** | Approval workflows for production |

### Enterprise
| Feature | Description |
|---------|-------------|
| 🔑 **OIDC Auth** | GitHub Actions, GitLab CI, K8s service accounts |
| 🛡️ **SAML SSO** | Okta, OneLogin, Azure AD, Google, Duo, Rippling |
| 🔄 **Secret Rotation** | Auto-rotate DB creds, AWS IAM, Azure SP |
| ⏰ **Dynamic Secrets** | Short-lived credentials with auto-expiry |
| 📤 **Log Forwarding** | Datadog, Splunk, Sumo Logic |
| 🌐 **28 Integrations** | GitHub, GitLab, Vercel, AWS, Azure, and more |

---

## Monorepo Layout

| Path | Purpose |
|------|---------|
| `packages/envsync-api` | Bun + Hono API (product + optional manage surface) |
| `packages/envsync-enterprise` | Proprietary EE modules/routes (mounted at `/api/v1/manage`) |
| `packages/envsync-enterprise-web` | Proprietary dashboard modules (injected into web) |
| `packages/envsync-cli` | Go CLI |
| `packages/envsync-kernel` | Shared MIT kernel (errors, `ApiModule`) |
| `packages/envsync-ui` | Shared MIT UI tokens/primitives |
| `apps/envsync-web` | React dashboard shell |
| `apps/envsync-landing` | Marketing landing (Hosted) |
| `packages/deploy` | Public OSS self-host CLI (`@envsync-cloud/deploy`) |
| `packages/deploy-cli` | EE deploy entry → `@envsync-cloud/deploy-enterprise` (private) |
| `packages/envsync-keycloak-theme` | Custom Keycloak theme |
| `sdks/envsync-ts-sdk` | Generated TypeScript SDK (core + manage) |
| `sdks/envsync-go-sdk` | Generated Go SDK (core + manage) |
| `scripts/` | Local bootstrap and helper scripts |

Editions / dual license: [EDITIONING.md](./EDITIONING.md) · self-host: [SELFHOSTING.md](./SELFHOSTING.md).

---

## Local Development

```bash
# 1. Clone and setup
git clone https://github.com/EnvSync-Cloud/envsync.git
cd envsync
cp .env.example .env
bun install

# 2. Start infrastructure
docker compose up -d

# 3. Initialize
bun run cli:init
bun run cli:create-dev-user --seed
bun run clickstack:sync

# 4. Start development
bun run dev
```

### Local Services

| Service | URL |
|---------|-----|
| 🖥️ Dashboard | `http://app.lvh.me:8001` |
| ⚡ API | `http://api.lvh.me:4000` |
| 🔐 Keycloak | `http://auth.lvh.me:8080` |
| 📊 HyperDX | `http://localhost:8800` |
| 📧 Mailpit | `http://localhost:8025` |
| 🗄️ RustFS | `http://localhost:19000` |
| 🔑 OpenFGA | `http://localhost:8090` |

---

## CLI Usage

```bash
# Authentication
envsync auth login
envsync auth whoami

# Project management
envsync init
envsync app list

# Secrets
envsync pull --env development
envsync push --env staging
envsync push --env production --strict

# Export
envsync export --format dotenv
envsync export --format json

# Run with secrets
envsync run -- npm start
```

---

## SDKs

One TypeScript package and one Go package cover **both** product and Enterprise manage routes. Set `BASE` / base URL to the **API origin** only (not a separate manage host).

### TypeScript
```typescript
import { EnvSyncAPISDK } from '@envsync-cloud/envsync-ts-sdk';

const sdk = new EnvSyncAPISDK({ BASE: 'https://api.envsync.cloud' });
const secrets = await sdk.secrets.getSecrets({ app_id: 'my-app' });
// Enterprise (when enabled): sdk.license.*, sdk.enterprise.*, … under /api/v1/manage
```

### Go
```go
import (
	"github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/client"
	"github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/option"
)

c := client.NewClient(option.WithBaseURL("https://api.envsync.cloud"))
// Product + manage packages on the same client (e.g. c.License, c.Enterprise)
```

---

## Deploy (all editions)

| Edition | Guide |
|---------|--------|
| Hosted Enterprise | Platform CI/CD |
| Self-host OSS | `envsync-deploy` |
| Self-host Enterprise | `envsync-deploy-enterprise` |

See **[DEPLOY.md](./DEPLOY.md)** for full instructions (DNS, CLI flow, env matrix, license, pitfalls).  
Self-host OSS short form: [SELFHOSTING.md](./SELFHOSTING.md). Editions: [EDITIONING.md](./EDITIONING.md).

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## Support

- 📖 Docs: [docs.envsync.cloud](https://docs.envsync.cloud)
- 🐛 Issues: [GitHub Issues](https://github.com/EnvSync-Cloud/envsync/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/EnvSync-Cloud/envsync/discussions)

---

<p align="center">
  Made with ❤️ by the EnvSync team
</p>
