# Deploying EnvSync (all editions)

This guide covers **how to deploy** EnvSync for every product edition:

| Edition | Mode | Who deploys | Tooling |
|---------|------|-------------|---------|
| **Hosted Enterprise** | SaaS multi-tenant | EnvSync platform operators | CI/CD + secrets (not public deploy CLI) |
| **Self-host OSS** | Single-org | Customer / operator | `@envsync-cloud/deploy` (`envsync-deploy`) |
| **Self-host Enterprise** | Licensed self-host | Customer / operator | `@envsync-cloud/deploy-enterprise` (`envsync-deploy-enterprise`) |

Edition matrix and package graph: [EDITIONING.md](./EDITIONING.md).  
OSS-focused long form (legacy title): [SELFHOSTING.md](./SELFHOSTING.md).  
Agent product facts: [AGENTS.md](./AGENTS.md).

---

## Architecture constants (all editions)

- **One API process** serves product routes at `/api/*`.
- **Enterprise manage** (when edition/modules allow) is on the **same** process at `/api/v1/manage/{module}/...` — license, integrations, rotation, OIDC/SAML, dynamic secrets, log forwarding.
- **No** separate `envsync-management-api` process and **no** `manage-api.*` public host.
- **One OpenAPI** document: `GET /openapi` (docs UI: `/docs`).
- **SDKs:** `@envsync-cloud/envsync-ts-sdk` and `envsync-go-sdk` only — set base URL to the **API origin** (not a manage host).
- **Dashboard:** single shell `envsync-web`; Enterprise/Hosted builds inject `envsync-enterprise-web`. There is no management SPA.

```text
Browser / CLI / SDKs
        │
        ▼
   api.<domain>  ── /api/*              (product)
                 └── /api/v1/manage/*   (Enterprise only)
   app.<domain>  ── dashboard
   auth.<domain> ── Keycloak
```

---

## 1. Hosted Enterprise (SaaS)

### Audience

Platform operators running EnvSync Cloud (multi-org, public signup, platform billing).

### Hybrid topology (recommended)

Most Hosted installs split **frontend** and **API/data plane**:

```text
                    Cloudflare
         ┌─────────────┴─────────────┐
         ▼                           ▼
   app.* / marketing              (static / Workers)
   envsync-web build:hosted       envsync-landing
         │                           │
         │  browser → API (CORS + cookies / OIDC)
         └─────────────┬─────────────┘
                       ▼
              Your API host (VPS / k8s)
         Traefik → api.*  / auth.*  / obs.*  / s3.*
         envsync-api (+ manage /api/v1/manage)
         Postgres, Redis, Keycloak, OpenFGA, miniKMS, RustFS, …
```

| Surface | Where it runs | How you deploy |
|---------|---------------|----------------|
| Dashboard | **Cloudflare** | `.github/workflows/deploy-fe.yaml` → `build:hosted` + Wrangler |
| Landing | **Cloudflare** | same workflow, `envsync-landing` job |
| API + infra | **Your server** | Swarm stack / compose (or `envsync-deploy*` for full self-host; for Hosted often monorepo-managed stack) |
| Auth (Keycloak) | **Your server** (or managed IdP) | Behind `auth.<domain>` |

**Do not** put the React apps on the VPS if CF is the source of truth for UI. Swarm may still run a `web_nginx` service for self-host; for Hosted hybrid you can leave it unused or remove it and point DNS only at CF.

#### DNS example

| Host | Target |
|------|--------|
| `app.envsync.example` | Cloudflare (Workers/Pages) |
| Apex / marketing | Cloudflare (landing) |
| `api.envsync.example` | VPS A-record / LB → Traefik |
| `auth.envsync.example` | VPS → Keycloak |
| `obs.` / `s3.` | VPS (optional) |

#### CF web build / runtime

```bash
# CI (already in deploy-fe.yaml)
bun run --filter envsync-web build:hosted
# secrets: VITE_API_BASE_URL=https://api.<domain>
#          VITE_SERVER_LICENSE=enterprise
```

Runtime config served to the browser (or baked at build):

```js
{
  apiBaseUrl: "https://api.<domain>",
  appBaseUrl: "https://app.<domain>",
  authBaseUrl: "https://auth.<domain>",
  managementApiUrl: "https://api.<domain>/api/v1/manage",
  edition: "enterprise",
  dashboardVariant: "enterprise",
  managementEnabled: true,
  deploymentMode: "hosted",
  canCreateOrganization: true
}
```

#### API host env (Hosted policy)

Same table as below, plus CORS/cookie origins must include CF app/landing URLs:

- `DASHBOARD_URL=https://app.<domain>`
- `LANDING_PAGE_URL=https://<marketing-domain>`
- Keycloak web redirect / callback URLs must use **API** callback + **CF app** callback (not localhost)

#### Migrate off legacy management-api container

Older stacks may still run `envsync-management-api` on port 4001. Current product:

1. Use **enterprise API image** (`envsync-api-enterprise`) with manage at `/api/v1/manage`.
2. Stop/remove the separate management-api service.
3. Point CF `managementApiUrl` at `https://api.<domain>/api/v1/manage` only.

### Policy env (API)

| Variable | Value |
|----------|--------|
| `ENVSYNC_DEPLOYMENT_MODE` | `hosted` |
| `ENVSYNC_EDITION` | `enterprise` |
| `ENVSYNC_LANDING_ENABLED` | `true` |
| `ENVSYNC_MANAGEMENT_ENABLED` | `true` |
| `ENVSYNC_LICENSE_ENFORCEMENT` | typically `false` (platform billing, not customer cert files) |
| `ENVSYNC_MAX_ORGS` | unset (unlimited Hosted multi-org via policy) |
| `DASHBOARD_URL` | Hosted app origin |
| `LANDING_PAGE_URL` | Hosted landing origin |
| `MANAGEMENT_API_URL` | `{API origin}/api/v1/manage` |

Do **not** mount customer entitlement PEMs on Hosted API for product multi-org.

### Images / artifacts

| Artifact | Notes |
|----------|--------|
| API | Enterprise-capable image (monorepo `docker/api-enterprise.Dockerfile` / `envsync-api-enterprise` tag) with manage modules |
| Web | **`build:hosted`** (or `build:enterprise`) — **never** `build:oss` for Hosted CF |
| Landing | `envsync-landing` on Cloudflare (Hosted-only) |

CI reference: `.github/workflows/deploy-fe.yaml` must use `bun run --filter envsync-web build:hosted`.  
Boundary CI fails Hosted FE if it uses OSS build.

### Runtime config (web)

```js
// illustrative — values from deploy secrets / CF env
{
  apiBaseUrl: "https://api.envsync.cloud",
  appBaseUrl: "https://app.envsync.cloud",
  managementApiUrl: "https://api.envsync.cloud/api/v1/manage",
  edition: "enterprise",
  dashboardVariant: "enterprise",
  managementEnabled: true,
  deploymentMode: "hosted",
  canCreateOrganization: true
}
```

### Org create

- Dashboard / landing: **Organization** create allowed (`POST /auth/create-organization`).
- No self-host setup-token path required for Hosted first org.

### Cutover checklist (high level)

1. Set Hosted API env (table above) before traffic.
2. Deploy API image with enterprise modules.
3. Deploy web with `build:hosted` + `envsync-enterprise-web` path filters.
4. Deploy landing separately.
5. Verify `/health`, `/openapi` (manage tags present), dashboard Integrations/License/Sync pages.

---

## 2. Self-host OSS

### Audience

Operators on a single public Linux host (Ubuntu/Debian) with Docker Swarm.

### Tooling

```bash
# Install
npm i -g @envsync-cloud/deploy
# or one-shot
npx @envsync-cloud/deploy --help

# Binary name
envsync-deploy
```

Package: public MIT `@envsync-cloud/deploy` (engine in `packages/deploy`).  
Does **not** pull enterprise packages or spawn `deploy-enterprise`.

### Requirements

- Swarm manager node, sudo/root
- Public DNS for `app`, `api`, `auth` (and optional `obs`, `s3`, `console.s3`)
- Ports `80` / `443` free
- Exact release version to pin

### DNS

| Host | Role |
|------|------|
| `app.<root>` | Dashboard |
| `api.<root>` | Product API only (no manage modules on OSS) |
| `auth.<root>` | Keycloak |
| `obs.<root>` | Observability (if enabled) |
| `s3.<root>` / `console.s3.<root>` | Object storage |

No landing host. No `manage-api` host.

### Install flow

```bash
# 1. Host prep (Docker, Swarm, packages)
npx @envsync-cloud/deploy preinstall

# 2. Write /etc/envsync/deploy.yaml (edition forced OSS by package)
npx @envsync-cloud/deploy setup

# 3. Destructive infra bootstrap + secrets/state
npx @envsync-cloud/deploy bootstrap
# automation:
# npx @envsync-cloud/deploy bootstrap --force

# 4. Roll out pinned release (blue/green API)
npx @envsync-cloud/deploy deploy
```

Status with no subcommand: `envsync-deploy` shows bootstrap state and next step.

### First organization (required)

Self-host has **no** public signup and **no** dashboard “Create organization”.

Setup token: `/etc/envsync/setup.token` (generated by deploy).

```bash
envsync-deploy org create --interactive

# or non-interactive
envsync-deploy org create \
  --name "Acme" \
  --email "admin@example.com" \
  --password 'Str0ng!Pass'

envsync-deploy org status
envsync-deploy health --json   # first_org.ready
```

OSS: **at most one** organization forever (via product policy).

### Runtime policy (API)

| Variable | Value |
|----------|--------|
| `ENVSYNC_DEPLOYMENT_MODE` | `selfhosted` |
| `ENVSYNC_EDITION` | `oss` |
| `ENVSYNC_LANDING_ENABLED` | `false` |
| `ENVSYNC_MANAGEMENT_ENABLED` | `false` |
| `ENVSYNC_LICENSE_ENFORCEMENT` | `false` / mode `none` |

Images: OSS web static (`envsync-web-oss-static`), standard API image **without** proprietary modules.

### Day-2 ops

```bash
# Upgrade (pin version of the deploy package + release)
bunx @envsync-cloud/deploy@0.20.0 upgrade
bunx @envsync-cloud/deploy@0.20.0 upgrade 0.20.0

envsync-deploy promote
envsync-deploy rollback

envsync-deploy backup
envsync-deploy restore /path/to/envsync-backup.tar.gz
envsync-deploy restore /path/to/envsync-backup.tar.gz --deploy

envsync-deploy health
envsync-deploy health --json
```

Blue/green: inactive API slot updates first; promote only when healthy; previous slot kept for rollback.

### Maintainer smoke (monorepo)

```bash
bun run selfhost:smoke:oss
```

---

## 3. Self-host Enterprise

### Audience

Operators deploying licensed Enterprise on their own Swarm host.

### Tooling

```bash
# Private GitHub Packages (auth required)
npm i -g @envsync-cloud/deploy-enterprise --registry=https://npm.pkg.github.com
envsync-deploy-enterprise --help
```

Thin entry over the OSS engine: forces `ENVSYNC_DEPLOY_FORCE_EDITION=enterprise`.  
Sources: `packages/deploy-cli` → published as `@envsync-cloud/deploy-enterprise`.

**Never** use public `@envsync-cloud/deploy` alone for a full EE install (wrong edition force + OSS image set).

### Flow (same shape as OSS)

```bash
envsync-deploy-enterprise preinstall
envsync-deploy-enterprise setup      # edition enterprise in deploy.yaml
envsync-deploy-enterprise bootstrap  # --force for automation
envsync-deploy-enterprise deploy
```

### DNS

Same hosts as OSS. **API host** also serves manage:

```text
https://api.<root>/api/...
https://api.<root>/api/v1/manage/...
```

Frontend runtime:

```json
"managementApiUrl": "https://api.<root>/api/v1/manage"
```

### Images / stack differences vs OSS

| Component | Enterprise self-host |
|-----------|----------------------|
| API | `ghcr.io/envsync-cloud/envsync-api-enterprise:<version>` (bundles manage modules) |
| Web | Enterprise static dashboard (`envsync-web-static` / `build:enterprise`) |
| Landing | **Not** deployed |
| License volume | Mount under `/etc/envsync/license` (cert/JWT paths from deploy) |
| Manage service | **None** (routes on API) |

### Runtime policy (API)

| Variable | Value |
|----------|--------|
| `ENVSYNC_DEPLOYMENT_MODE` | **`selfhosted`** (required — missing defaults enterprise→hosted policy) |
| `ENVSYNC_EDITION` | `enterprise` |
| `ENVSYNC_MANAGEMENT_ENABLED` | `true` |
| `ENVSYNC_LANDING_ENABLED` | `false` |
| `ENVSYNC_LICENSE_ENFORCEMENT` | `true` |
| `ENVSYNC_LICENSE_MODE` | `certificate` / entitlement as configured |
| License paths | e.g. bundle/cert/key/root CA under `/etc/envsync/license/` |
| `MANAGEMENT_API_URL` | `https://api.<root>/api/v1/manage` |

### License

- Install entitlement JWT and/or certificate material via deploy / operator process (private license-server signs entitlements; **keys never in the public monorepo**).
- Dashboard: **Organization → License** (`/organisation/license`) — activate / verify against manage routes.
- Multi-org on self-host EE: **only** via deploy CLI `org create` when entitlement `max_orgs` allows — **never** via web.

### First and further orgs

```bash
# First org (required)
envsync-deploy-enterprise org create --interactive

# Further orgs only if license claims allow
envsync-deploy-enterprise org create --name "Second" --email "..." --password '...'

envsync-deploy-enterprise org status
envsync-deploy-enterprise health --json
```

### Day-2

Same subcommands as OSS (`upgrade`, `promote`, `rollback`, `backup`, `restore`, `health`) via `envsync-deploy-enterprise`.

---

## 4. Side-by-side comparison

| Concern | Hosted | Self-host OSS | Self-host Enterprise |
|---------|--------|---------------|----------------------|
| Deploy CLI | Platform CI/CD | `envsync-deploy` | `envsync-deploy-enterprise` |
| `ENVSYNC_DEPLOYMENT_MODE` | `hosted` | `selfhosted` | `selfhosted` |
| `ENVSYNC_EDITION` | `enterprise` | `oss` | `enterprise` |
| API image | Enterprise modules | OSS / no EE package | `envsync-api-enterprise` |
| Web build | `build:hosted` | `build:oss` | `build:enterprise` |
| Landing | Yes (Cloudflare) | No | No |
| `/api/v1/manage` | Yes | No | Yes |
| Dashboard create org | Yes | No | No |
| First org | Landing / dashboard | Deploy `org create` | Deploy `org create` |
| Further orgs | Dashboard | Never | CLI + `max_orgs` claim |
| License | Platform billing | N/A | Cert / entitlement JWT |
| Public signup | Yes | No | No |

---

## 5. Local development (not production)

Monorepo root — **not** a substitute for Swarm deploy:

```bash
cp .env.example .env
bun install
docker compose up -d
bun run cli init
bun run clickstack:sync
bun run dev
```

| Service | Local URL |
|---------|-----------|
| Dashboard | `http://app.lvh.me:8001` |
| API | `http://api.lvh.me:4000` |
| Manage (if EE enabled locally) | `http://api.lvh.me:4000/api/v1/manage/...` |
| Keycloak | `http://auth.lvh.me:8080` |

Defaults often favor Hosted-like enterprise for DX. For self-host policy locally set:

```bash
ENVSYNC_DEPLOYMENT_MODE=selfhosted
ENVSYNC_EDITION=oss   # or enterprise
```

---

## 6. Common pitfalls

1. **Self-host EE without `ENVSYNC_DEPLOYMENT_MODE=selfhosted`** — policy behaves like Hosted multi-org.
2. **Hosted web built with `build:oss`** — Integrations / License / Sync pages missing.
3. **Pointing clients at a manage-api host or `:4001`** — obsolete; use API origin + `/api/v1/manage`.
4. **Using management SDKs** — removed; use core TS/Go SDKs.
5. **Dashboard org-create on self-host** — blocked by product policy; use deploy `org create`.
6. **OSS deploy package for full EE** — wrong edition force and image plan.

---

## 7. Related packages

| Path / package | Role |
|----------------|------|
| `packages/deploy` | OSS deploy engine + public npm package |
| `packages/deploy-cli` | EE thin entry → private `deploy-enterprise` |
| `packages/deploy-core` | Topology / runtime-env planning |
| `docker/api-enterprise.Dockerfile` | EE API image (core + manage modules) |
| `packages/envsync-api` | API process |
| `packages/envsync-enterprise` | Proprietary manage modules |
| `packages/envsync-enterprise-web` | EE dashboard modules |
| Private `license-server` repo | Entitlement signing (keys never in monorepo) |

---

## 8. Quick decision tree

```text
Deploying EnvSync Cloud SaaS?
  └─ Hosted Enterprise (section 1) — platform CI + build:hosted

Customer self-host, open-source only?
  └─ Self-host OSS (section 2) — envsync-deploy

Customer self-host with paid Enterprise license?
  └─ Self-host Enterprise (section 3) — envsync-deploy-enterprise
       + license files + api-enterprise image
```
