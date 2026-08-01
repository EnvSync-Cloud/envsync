# Hosted cutover runbook (H1.4–H1.5)

**Track:** `feat/the-big-update`  
**Related:** [plans/phase-h1/README.md](./plans/phase-h1/README.md), [SUPPORT.md](./SUPPORT.md), [LICENSE-RUNBOOK.md](./LICENSE-RUNBOOK.md)

Use this when promoting the no-piggyback track to **EnvSync Cloud Hosted** (API + dashboard + landing).

---

## 1. Secrets / runtime checklist (H1.4)

Apply in Hosted secrets manager / CF env / k8s before traffic cutover.

### API (core process)

| Variable | Hosted value | Required |
|----------|--------------|----------|
| `ENVSYNC_DEPLOYMENT_MODE` | `hosted` | **Yes** |
| `ENVSYNC_EDITION` | `enterprise` | **Yes** |
| `ENVSYNC_LICENSE_ENFORCEMENT` | `false` (or platform-only path) | Typical |
| `ENVSYNC_MAX_ORGS` | *unset* | Yes — Hosted unlimited via policy |
| `ENVSYNC_MAX_ORGS_SUPPORT_OVERRIDE` | unset / false | Yes |
| `ENVSYNC_LANDING_ENABLED` | `true` | Product |
| `ENVSYNC_MANAGEMENT_ENABLED` | `true` if management process used | Platform |
| `DASHBOARD_URL` | Hosted dashboard origin | Yes |
| `LANDING_PAGE_URL` | Hosted landing origin | Yes |
| `MANAGEMENT_API_URL` | Platform management API URL | Yes |
| Keycloak / DB / Redis / FGA / miniKMS | existing Hosted values | Yes |

Do **not** mount customer entitlement files on Hosted API pods for product features (platform billing).

### Management API (if separate process)

| Variable | Notes |
|----------|--------|
| Same DB / FGA / Keycloak as core | Shared tenancy |
| Registers `enterpriseManagementModules` | From `envsync-enterprise` |
| `ENVSYNC_DEPLOYMENT_MODE=hosted` | Match core |

### Frontend (Cloudflare Pages / Workers)

| Item | Value |
|------|--------|
| Build command | `bun run --filter envsync-web build:hosted` |
| Workflow | `.github/workflows/deploy-fe.yaml` — **never** `build:oss` for Hosted |
| Path filters | include `packages/envsync-enterprise-web/**` |
| `VITE_*` / runtime-config | enterprise edition + API + managementApiUrl aligned with secrets |

Landing: existing `envsync-landing` deploy; no self-host requirement.

### Pre-flight local/CI checks

```sh
bun run check:boundaries
# optional automated checklist (no live deploy required):
bun run scripts/hosted-cutover-check.ts
```

---

## 2. Deploy order (H1.3)

```text
1. Feature freeze on track (only cutover fixes)
2. Deploy API (+ management-api)
3. Smoke API: POST /api/auth/create-organization (hosted session → 200)
4. Confirm SDKs call create-organization (not create-workspace)
5. Deploy envsync-web via deploy-fe (build:hosted)
6. Deploy landing if needed
7. Remove any /manage reverse-proxy leftovers
8. UI e2e: organization-switcher / create-organization testids
```

**Rule:** Do not ship P7 API alone while any Hosted client still posts `create-workspace`. First-party web is migrated; third-party SDK clients are the risk.

---

## 3. Staging smoke checklist (H1.5)

Run against **Hosted staging** after deploy. Mark each item.

### Build / CI (pre-prod)

- [ ] `deploy-fe` uses `build:hosted` or `build:enterprise` (not `build:oss`)
- [ ] Path filter includes `envsync-enterprise-web`
- [ ] Public TS/Go SDK: no live URL `/api/auth/create-workspace`
- [ ] `bun run check:boundaries` green
- [ ] Self-host OSS image matrix still `build:oss` (`release.yml`)

### API smoke (staging)

- [ ] Login as Hosted user
- [ ] `POST /api/auth/create-organization` succeeds
- [ ] Switch organization (if multi-membership)
- [ ] Self-host policy regression: selfhosted session still **cannot** create org from dashboard channel

### Dashboard smoke (enterprise modules)

- [ ] `/organisation/integrations` (or project integrations) loads
- [ ] License / organisation license page loads
- [ ] Sync operations page loads
- [ ] No `/manage` dependency or 404 cascade from old management SPA

### Post-cutover monitors

- [ ] 404 rate on `/api/auth/create-workspace` → **zero** (clients fixed)
- [ ] EE route 404s → zero
- [ ] Org create success rate no regression

### Local dry-run helper

```sh
# Validates repo + optional live base URL
HOSTED_SMOKE_BASE_URL=https://staging-api.example.com \
HOSTED_SMOKE_TOKEN=... \
  bun run scripts/hosted-cutover-check.ts
```

Without `HOSTED_SMOKE_*`, the script only checks **repo invariants** (workflow, SDK paths, edition docs).

---

## 4. Rollback

1. Revert CF web to previous deployment (prefer keep enterprise build).
2. API rollback only if create-organization is broken; avoid leaving API on P7 while web still calls create-workspace.
3. Do not reintroduce `build:oss` for Hosted to “fix” EE 404s — that removes EE modules entirely.

---

## 5. Sign-off

| Role | Sign-off |
|------|----------|
| Eng (boundaries + SDK) | |
| Ops (secrets H1.4) | |
| QA (staging H1.5) | |
| On-call after first Hosted deploy | |
