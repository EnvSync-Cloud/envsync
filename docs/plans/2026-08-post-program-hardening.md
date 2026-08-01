# Plan: Post–no-piggyback hardening & Hosted cutover

**Status:** H1–H6 code slices complete on `feat/the-big-update` (ops cutover H1.4–H1.5 still open)  
**Date:** 2026-08-01  
**Depends on:** [2026-08-no-piggyback-program.md](./2026-08-no-piggyback-program.md) (phases 0–7 complete on track)  
**Branch convention:** continue `feat/the-big-update` · slices `feat/the-big-update-hN` (h = hardening)

## 0. Context

P0–P7 delivered **product law** (deployment mode, org-create channels, deploy split, entitlements verify, enterprise FE package, kill management SPA, dual-license docs, deprecation close).  

Architecture review findings:

| Theme | Grade | Gap |
|-------|-------|-----|
| Product policy | Strong | Hosted FE CI still builds **OSS** |
| Package seams | Partial | EE engines still in MIT `envsync-api` |
| Dual-license honesty | Partial | Docs ahead of physical source split |
| Hosted readiness | Risky | SDK still calls deleted `create-workspace` |
| Design system (D12) | Missing | No `envsync-ui` |

This plan closes **ship blockers first**, then **honest modularization**, then **polish**.

---

## 1. Goals

1. **Safe Hosted production cutover** of `feat/the-big-update` without losing EE dashboard features or breaking org create.  
2. **Client contract alignment** (OpenAPI + SDKs match live API).  
3. **Finish open-core package honesty** enough that OSS SBOM/legal story is defensible.  
4. **Clear ops runbooks** for Hosted vs Self-host EE.  
5. **Optional:** design tokens (`envsync-ui`) so EE modules stop depending on shell CSS drift.

Non-goals (same as program): hard DRM, Next-only BFF, nested workspace entity, resurrecting management SPA.

---

## 2. Workstreams (ordered)

```text
H0  Review freeze + cutover checklist (this doc)
 │
 ├─► H1  Hosted ship blockers (FE edition + SDK + deploy order)     ◄── CRITICAL PATH
 │
 ├─► H2  Naming / residual aliases (WorkspaceProvisioningService…)
 │
 ├─► H3  EE physical extraction + migration streams (open-core honesty)
 │
 ├─► H4  License issuer alignment (self-host; Hosted optional)
 │
 ├─► H5  envsync-ui tokens (D12)
 │
 └─► H6  Docs drift + SBOM/CI hardening
```

H1 is **required before merge-to-main / Hosted prod**. H2–H6 can stack after or parallel where noted.

---

## 3. H1 — Hosted ship blockers (critical path)

**Duration:** 1–3 days  
**Exit:** Hosted can deploy API + enterprise dashboard + landing without 404 org-create or missing Integrations/License/Sync.

### H1.1 Fix Hosted frontend build edition

| Item | Action |
|------|--------|
| **Problem** | `.github/workflows/deploy-fe.yaml` runs `envsync-web` **`build:oss`** → empty enterprise modules |
| **Fix** | Hosted CF job uses **`build:enterprise`** (or new `build:hosted` alias = enterprise modules + Hosted env) |
| **Env** | Ensure `VITE_SERVER_LICENSE=enterprise` (or whatever Vite uses for `@enterprise-modules`) for Hosted |
| **Paths trigger** | Add `packages/envsync-enterprise-web/**` to `deploy-fe` path filters so EE UI changes redeploy web |
| **Acceptance** | Hosted dist contains `ProjectIntegrations` / `LicenseSettings` / `SyncOperations` chunks (or equivalent); OSS self-host image pipeline **unchanged** (`build:oss` / `envsync-web-oss-static`) |

Optional clarity:

```json
// apps/envsync-web/package.json
"build:hosted": "VITE_SERVER_LICENSE=enterprise vite build"
```

Use `build:hosted` in CF workflow so intent is obvious.

### H1.2 Regenerate public SDKs for org create

| Item | Action |
|------|--------|
| **Problem** | `envsync-ts-sdk` `createWorkspace` → `POST /api/auth/create-workspace` (**route removed in P7**) |
| **Fix** | Regen OpenAPI from running/local API → `createOrganization` + `/api/auth/create-organization` |
| **Packages** | `@envsync-cloud/envsync-ts-sdk`, Go public SDK if generated from same OpenAPI |
| **Compat** | Prefer SDK method `createOrganization`; if needed, keep thin deprecated wrapper that calls new path for one minor (SDK-only; **do not** reintroduce API route) |
| **Acceptance** | No generated client references `/api/auth/create-workspace`; dashboard already uses create-organization (no change required) |

Commands (adjust to repo scripts):

```sh
# from packages/envsync-api or sdks as documented
bun run --filter @envsync-cloud/envsync-ts-sdk generate:local
# go generator if used in CI
```

### H1.3 Hosted deploy order & freeze window

| Step | Component | Notes |
|------|-----------|--------|
| 0 | Feature freeze on track | Only H1 fixes |
| 1 | **API** (+ management-api if separate process) | Policy, create-organization, entitlement code |
| 2 | Smoke API | `POST /auth/create-organization` 200 hosted session; self-host still 403 |
| 3 | **SDKs** published/workspace-linked | Before any external client redeploy |
| 4 | **envsync-web** enterprise/hosted build → CF | After API is live (web already on new path) |
| 5 | **envsync-landing** | If needed for env/SDK; usually independent |
| 6 | Remove `/manage` proxy / old management SPA artifacts | No merge-management script |
| 7 | UI e2e | `organization-switcher-*`, `create-organization-*` |

**Rule:** Do **not** deploy P7 API alone while any Hosted client still posts `create-workspace`. First-party web is already migrated; third-party/SDK is the risk.

### H1.4 Hosted runtime env checklist

| Var | Hosted value | Notes |
|-----|--------------|--------|
| `ENVSYNC_DEPLOYMENT_MODE` | `hosted` | Required |
| `ENVSYNC_EDITION` | `enterprise` | Typical |
| `ENVSYNC_LICENSE_ENFORCEMENT` | `false` (or platform-specific) | Hosted bypasses customer JWT in `assertFeature`; do not require install entitlement file |
| `ENVSYNC_MAX_ORGS` | unset | Hosted unlimited via policy |
| `ENVSYNC_LANDING_ENABLED` | `true` | Product |
| Management API URL | platform URL | Dashboard runtime config / secrets |
| FE `VITE_*` / runtime-config | enterprise edition + managementApiUrl | Must match API |

### H1.5 Acceptance (H1)

- [ ] `deploy-fe` (or Hosted-only workflow) builds **enterprise/hosted** web  
- [ ] Path filter includes `envsync-enterprise-web`  
- [ ] Public TS SDK has `createOrganization` / correct path  
- [ ] Hosted smoke: login → create organization → switch org  
- [ ] Hosted smoke: `/organisation/integrations`, `/licence` or `/organisation/license`, `/organisation/sync` load (enterprise build)  
- [ ] No `/manage` dependency  
- [ ] Self-host OSS image still `build:oss`  

---

## 4. H2 — Naming residual cleanup

**Duration:** 0.5–1 day  
**Can parallel with H1 after API path is frozen.**

| ID | Work |
|----|------|
| H2.1 | Rename `WorkspaceProvisioningService` → `OrganizationProvisioningService` (or keep file + rename methods) |
| H2.2 | Saga name `createWorkspaceForExistingIdentity` → `createOrganizationForExistingIdentity` |
| H2.3 | Rename e2e file `workspaces.spec.ts` → `organizations.spec.ts` |
| H2.4 | Grep residual user-facing “workspace” in Hosted-critical paths; leave IdP “google-workspace” alone |

**Acceptance:** No new public API named workspace; internal names consistent with Organization.

---

## 5. H3 — Open-core package honesty (EE extraction)

**Duration:** 2–6 weeks (phased)  
**Depends on:** H1 shipped (or not blocked by H1)

### Direction

```text
Today:  envsync-api contains EE services; envsync-enterprise only registers modules
Target: envsync-api core surface only; envsync-enterprise owns EE services + EE migrations
```

### Slices

| ID | Work | Risk |
|----|------|------|
| H3.1 | Inventory EE surface: routes already gated + services + migrations 018+ license/enterprise | Low |
| H3.2 | Move **non-HTTP** pure EE services into `envsync-enterprise` (sync, integration, provider) with api re-export shims for one release | Medium |
| H3.3 | Point management route loaders at enterprise package implementations (no `@/services/enterprise-*` from core long-term) | Medium |
| H3.4 | Split migrations: core stream vs `envsync-enterprise/migrations`; management process runs EE stream | High |
| H3.5 | OSS Docker build / CI: fail if `envsync-api` production graph imports `envsync-enterprise` **or** if OSS image contains EE service paths (strengthen `check:boundaries`) | Medium |
| H3.6 | Optional: `envsync-core-domain` for shared org/app/secret used by both processes | Medium |

### Acceptance (H3)

- [ ] Core process does not start enterprise sync worker  
- [ ] Management process owns EE background handlers via enterprise package  
- [ ] OSS image/SBOM policy documented and CI-enforced at chosen strictness  
- [ ] Dual-license package map matches directory ownership  

**Pragmatic bar for “good enough dual-license”:** H3.2 + H3.5 without full migration split may be enough for v1 legal story; H3.4 is full honesty.

---

## 6. H4 — License issuer & self-host ops (Hosted light)

**Duration:** 1–2 weeks (mostly private license-server + docs)

| ID | Work | Hosted impact |
|----|------|----------------|
| H4.1 | License-server activate/verify returns **entitlement JWT** as `signed_lease` (Ed25519, iss=`envsync-license-server`) | Low (Hosted bypass) |
| H4.2 | Document Hosted: platform billing; no customer entitlement file | Docs only |
| H4.3 | Self-host EE: mount JWT path / certificate path; `ENVSYNC_LICENSE_ENFORCEMENT=true` runbook | Self-host |
| H4.4 | E2E: invalid entitlement → feature 403; Hosted still allows multi-org without JWT | CI |

---

## 7. H5 — `envsync-ui` (D12)

**Duration:** 1–2 weeks parallel  

| ID | Work |
|----|------|
| H5.1 | Create `packages/envsync-ui` (MIT): CSS variables + Tailwind preset |
| H5.2 | Wire `envsync-web` + `envsync-landing` to preset |
| H5.3 | Enterprise-web pages consume tokens via shell or direct package dep |
| H5.4 | Stop new token copy-paste in apps |

Does **not** block Hosted cutover.

---

## 8. H6 — Docs, CI, ambiguity closure

| ID | Work |
|----|------|
| H6.1 | Update program plan status header (P0–P7 complete; pointer to this plan) |
| H6.2 | Hosted vs Self-host **edition matrix** one-pager in `docs/SUPPORT.md` (link Hosted FE must be enterprise build) |
| H6.3 | CI: assert `deploy-fe` does not use `build:oss` for Hosted job (grep workflow test) |
| H6.4 | CI: assert SDK OpenAPI paths do not include `/auth/create-workspace` |
| H6.5 | Clarify default `ENVSYNC_EDITION=enterprise` + missing mode → hosted in CONTRIBUTING (footgun note) |
| H6.6 | Optional: make `envsync-enterprise-web` a **devDependency** or optional dep of web for OSS purity (if legal requires) |

---

## 9. Decision log (resolve before H1 merge)

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| Q1 | Hosted dashboard build | OSS shell only vs **enterprise modules** | **Enterprise/hosted build** — EE UX was absorbed into dashboard (5c) |
| Q2 | SDK createWorkspace | Delete only vs deprecated wrapper calling new path | **Wrapper one minor** for external clients; API route stays deleted |
| Q3 | Hosted license enforcement | Always off vs platform internal | **Off / hosted bypass** (current code) |
| Q4 | EE extraction urgency | Before vs after Hosted cutover | **After H1** — cutover first |
| Q5 | envsync-ui | Parallel vs later | **Parallel after H1** |

---

## 10. Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hosted ships OSS FE without EE pages | High if H1.1 skipped | High | Workflow fix + path filter + smoke |
| External client 404 on create-workspace | Medium | High | SDK regen + release notes |
| Coupling `@shell` breaks EE build | Medium | Medium | Typecheck enterprise-web in CI against shell paths |
| EE move breaks management e2e | Medium | High | Incremental shims; e2e gate on H3 |
| Legal dual-license challenged | Low–Med | High | H3.5 + clear LICENSE map |

---

## 11. Suggested execution board

### Sprint A (cutover) — **do first**

- [x] H1.1 deploy-fe → `build:hosted` / enterprise  (branch `feat/the-big-update-h1`)  
- [x] H1.2 SDK createOrganization path + deprecated createWorkspace wrapper  
- [x] H1.3 deploy order runbook — [phase-h1/README.md](./phase-h1/README.md)  
- [ ] H1.4 env checklist applied to Hosted secrets (ops)  
- [ ] H1.5 smoke checklist green (staging)  
- [x] H6.3 + H6.4 CI guards (in `check:boundaries`)

### Sprint B (hygiene)

- [x] H2 naming (`feat/the-big-update-h2`)  
- [x] H6.1 program plan status  
- [x] H6.2 SUPPORT edition matrix  
- [x] H6.5 footgun docs  
- [x] H6.6 envsync-enterprise-web as web devDependency  
- [x] H6 full — [phase-h6/README.md](./phase-h6/README.md)  

### Sprint C (architecture depth)

- [x] H3.1 inventory — [phase-h3/README.md](./phase-h3/README.md)  
- [x] H3.2–H3.3 first EE service move (integration/sync/provider + cert verifier)  
- [ ] H3.4 migration streams / remaining OIDC–rotation move  
- [x] H4.1 issuer JWT (EdDSA entitlement) — [phase-h4/README.md](./phase-h4/README.md)  
- [x] H4.2–H4.4 runbooks + tests

### Sprint D (design system)

- [x] H5.1–H5.3 envsync-ui — [phase-h5/README.md](./phase-h5/README.md)

---

## 12. Hosted cutover one-pager (ops)

```text
Pre:
  - Merge H1 fixes into feat/the-big-update (or main)
  - Confirm DEPLOYMENT_MODE=hosted on API
  - Confirm FE will build enterprise modules

Deploy:
  1. API (+ management-api)
  2. Smoke create-organization + whoami policy
  3. Publish/link SDKs
  4. CF web (enterprise/hosted build)
  5. CF landing if needed
  6. Drop /manage

Post:
  - Monitor 404s on /api/auth/create-workspace (should be zero; clients fixed)
  - Monitor dashboard EE routes
  - UI e2e organization-* testids
```

---

## 13. Success metrics

| Metric | Target |
|--------|--------|
| Hosted org create success rate | No regression vs pre-cutover |
| Hosted EE route 404 | Zero for integrations/license/sync |
| SDK create-workspace path references | Zero in generated clients |
| Boundary CI | Still green; new FE/SDK guards green |
| Dual-license source map | Documented; H3 progress tracked |

---

## 14. Relationship to program phases

| Program phase | This plan |
|---------------|-----------|
| P0–P7 | Done on track |
| **H1** | Unblocks Hosted production |
| H2 | Phase 6/7 naming leftovers |
| H3 | Completes Phase 5 “full extraction” deferred work |
| H4 | Completes Phase 4 issuer side |
| H5 | Phase 0/D12 deferred |
| H6 | Continuous hygiene |

---

## 15. Immediate next command (when implementing)

1. Branch `feat/the-big-update-h1` from `feat/the-big-update`.  
2. Implement H1.1 + H1.2 + CI guards only.  
3. Run Hosted smoke on staging.  
4. Then merge track to main / cut over.

Do **not** start H3 extraction in the same PR as Hosted cutover.
