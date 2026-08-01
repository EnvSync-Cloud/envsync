# EnvSync Program Plan: No Piggybacking

**Status:** Decisions locked; **implementation P0–P7 complete on `feat/the-big-update`**.  
**Hardening:** H1–H6 on track (`feat/the-big-update-hN`) — see [2026-08-post-program-hardening.md](./2026-08-post-program-hardening.md).  
**Remaining ops (not code):** Hosted secrets checklist + staging smoke (H1.4–H1.5); deeper EE extraction (H3.4+); private license-server publish.  
**Date:** 2026-08-01 (amended same day: org channels, license ops, FE D9–D12; post-review hardening plan same day)  
**Track:** `feat/the-big-update` · phases `feat/the-big-update-pN` · hardening `feat/the-big-update-hN`  
**Scope:** Tenancy, org-create channels, deploy CLIs, management API, licensing, landing, dual-license monorepo, FE injection, design tokens  

**Thread completeness:** This document is the single source of truth for every product decision from the end-to-end audit through FE amendments. See **§0.6 Decision coverage checklist**.  
**Phase 0 exit:** [docs/plans/phase-0/README.md](./phase-0/README.md) · [ADR 0001](../adr/0001-no-piggyback-program.md)

---

## 0. Locked decisions

### 0.1 Core product (questionnaire D1–D8)

| # | Topic | Decision |
|---|--------|----------|
| D1 | Self-host tenancy | **OSS = single-org always.** **Enterprise self-host = multi-org only when licensed** (`max_orgs` / `multi_org` claim). Default without claim: **1**. |
| D2 | Multi-workspace | **Retire** multi-org alias. Hosted multi-org is **Organization**. No nested workspace entity in this program. |
| D3 | Landing | **Hosted marketing + public signup UI only.** Never required on self-host. |
| D4 | Deploy CLI | **Two products:** public OSS CLI + **private** enterprise CLI. No spawn shim. |
| D5 | Management API | **Real separate package + process;** shared **kernel only**. |
| D6 | Legal / repo | **Public monorepo + dual license** (PostHog/Coder style). |
| D7 | Licensing | **Coder-style entitlements** (signed claims, per-feature gates, grace). Private license-server OK; CA private key lives only there. |
| D8 | Hosted vs self-host | First-class **`ENVSYNC_DEPLOYMENT_MODE=hosted \| selfhosted`**. |

### 0.2 Org-create channels (thread refinement — supersedes earlier “web if entitled”)

| # | Topic | Decision |
|---|--------|----------|
| D13 | Hosted public signup **code** | **UI:** `apps/envsync-landing`. **API:** core onboarding routes, enabled **only** when `deployment_mode=hosted` (+ public signup policy). |
| D14 | OSS self-host first org | **First-boot wizard and/or deploy CLI** (`org create` / bootstrap prompt). Exactly once. |
| D15 | EE self-host first org | **Enterprise deploy CLI only** at bootstrap finish (interactive create first org + admin). **Not** web. **Not** public signup. |
| D16 | EE self-host further orgs | **Enterprise deploy CLI only**, and only if license allows (`max_orgs > 1`). **Not** dashboard, **not** cookie `create-workspace`. |
| D17 | Self-host web session | **Never** creates organizations (any edition). Switch-org only if multiple memberships already exist. User invites remain. |
| D18 | Hosted create org (logged-in) | Dashboard **Organization** create + API allowed (SaaS). Rename away from “workspace”. |
| D19 | Operator auth for CLI org create | CLI uses **operator/bootstrap credential** (setup token, local admin socket, or one-time bootstrap secret)—**not** normal end-user web session. Prefer locked-down admin/setup API or deploy-local provision path. |

### 0.3 License placement & threat model (thread)

| # | Topic | Decision |
|---|--------|----------|
| D20 | Where license **lives** | **Issuer:** private license-server only (signing keys). **Install:** `/etc/envsync/license/` (JWT and/or bundle), mounted into API/management. **Binary:** **public verify key only**. DB/Redis = cache, not authority (Phase 4). |
| D21 | How license is **issued** | Online: customer key → activate → signed entitlement file. Offline/air-gap: EnvSync issues signed JWT/file bound to fingerprint; CLI `license add -f`. |
| D22 | Threat model | **Goal:** stop script-kiddie env/SQL bypass. **Not a goal:** stop determined fork that patches source (open-core honesty; legal/trademark/support are moat). Hosted revenue does not depend on customer-side DRM. |

### 0.4 Frontend (thread amendment)

| # | Topic | Decision |
|---|--------|----------|
| D9 | Dashboard shell | **One** shell: `envsync-web`. |
| D10 | EE FE injection | Real package **`envsync-enterprise-web`** modules—not only in-tree pages + Vite stub. |
| D11 | `envsync-management-web` | **Deprecated → delete** after absorb into EE dashboard modules. |
| D12 | Design system | **`packages/envsync-ui`**: shared design tokens (+ optional light primitives). Consumers: web, landing, EE modules. |

### 0.5 Explicit non-goals (thread)

| # | Topic | Decision |
|---|--------|----------|
| N1 | Next.js Server Actions–only + no public APIs | **Out of program.** Machine APIs stay for CLI/SDK. Optional BFF later. |
| N2 | Nested workspace entity under org | **Out of program.** |
| N3 | Hard DRM / uncrackable EE | **Out.** Entitlements + dual license only. |
| N4 | Landing in self-host Swarm | **Out.** |
| N5 | Long-term management SPA | **Out** (D11). |

### 0.6 Decision coverage checklist (full thread)

| Discussion theme | Decisions | Planned phase(s) |
|------------------|-----------|------------------|
| Deploy CLI piggyback | D4 | 3 |
| Licensing flawed / Coder-style | D7, D20–D22 | 4 |
| CA key private repo OK | D7, D20 | 4 (issuer private) |
| Landing out of self-host | D3, D13 | 1 (signup gate), 2 |
| Management API piggyback | D5 | 5 |
| Public signup hosted-only | D3, D13 | 1 |
| Multi-workspace piggyback | D2, D14–D18 | 1, 1b (CLI) |
| Self-host EE multi-org licensed | D1, D16 | 1 interim, 4 full |
| deployment_mode | D8 | 1 |
| Dual-license monorepo | D6 | 5–6 |
| Hosted signup code location | D13 | 1–2 |
| OSS first org boot/CLI | D14 | 1b |
| EE org create CLI-only | D15–D17, D19 | 1, 1b |
| License on disk / issue flow | D20–D21 | 3–4 |
| Threat model honesty | D22 | 4 + docs |
| FE module injection | D10 | 5b |
| Kill management-web | D11 | 5c |
| envsync-ui tokens | D12 | 0 inventory, early parallel |
| Next.js migration | N1 | non-goal |

### Invariants (product law)

1. **No piggybacking:** shared *libraries* yes; shared *product shells* with flags/shims/renames no.  
2. **Hosted** is multi-tenant SaaS. **Self-host OSS** is single-tenant FOSS. **Self-host Enterprise** is single-tenant by default; multi-org only via **license claims** and **CLI**.  
3. **Org-create channel is product-specific** (see §1.1a)—never “any enterprise session can mint orgs.”  
4. **Landing** is not part of self-host runtime.  
5. **OSS deploy tooling** must work without enterprise packages or monorepo paths.  
6. **Enterprise features** require **verified entitlements**, not `ENVSYNC_EDITION` alone.  
7. **One dashboard shell**; EE UI via package injection; no second management SPA.  
8. **Design tokens** live in `envsync-ui`, not copy-pasted per app.

---

## 1. Target product matrix

### 1.1 Deployment × edition

| | Hosted Enterprise | Self-host OSS | Self-host Enterprise |
|--|-------------------|---------------|----------------------|
| `DEPLOYMENT_MODE` | `hosted` | `selfhosted` | `selfhosted` |
| `EDITION` | `enterprise` | `oss` | `enterprise` |
| Public org signup (landing + API) | Yes | No | No |
| Multi-org | Yes (SaaS) | No (`max_orgs=1`) | Licensed only (default **1**) |
| First org | Landing signup / platform | **First-boot and/or OSS deploy CLI** | **EE deploy CLI at bootstrap only** |
| Further orgs | Dashboard + hosted API | Never | **EE deploy CLI only** + entitlement |
| Web `create-workspace` / create-org | Yes (as Organization) | **No** | **No** |
| Landing service | Cloudflare (separate) | No | No |
| Management API process | EnvSync-operated | No | Yes |
| License | Platform billing | N/A | File under `/etc/envsync/license` + entitlements |
| Deploy tool | N/A (platform) | Public `@envsync-cloud/deploy` | Private enterprise deploy package |
| Dashboard app | `envsync-web` (+ EE modules) | `envsync-web` OSS build | `envsync-web` EE build |
| Management SPA | **None** (deleted) | None | None |

### 1.1a Org-create channel matrix (authoritative)

| Channel | Hosted | Self-host OSS | Self-host EE |
|---------|--------|---------------|--------------|
| Landing `POST /onboarding/org*` | Allow | **Deny** | **Deny** |
| Web session `POST /auth/create-workspace` (→ createOrganization) | Allow | **Deny** | **Deny** |
| Deploy/bootstrap interactive first org | N/A | **Allow** if `org_count=0` | **Allow** if `org_count=0` |
| Deploy CLI `org create` | N/A | **Allow** only if `org_count=0` | **Allow** if under `max_orgs` + entitled |
| User invite accept | Allow (join org) | Allow (join only) | Allow (join only) |
| Dev/seed scripts | Hosted harness | Local dev only | Local dev only |

**Channel attribute on provision:** every create path must pass `source: "hosted_signup" | "hosted_dashboard" | "selfhost_bootstrap" | "selfhost_cli" | "dev"` into policy so mis-wired callers fail closed.

### 1.2 Tenancy vocabulary

| Term | Meaning |
|------|---------|
| **Organization** | Tenant boundary (DB `orgs`): PKI root, members, apps, isolation. |
| **Project / App** | Work unit under one org (existing). |
| **Workspace** | **Deprecated** as multi-org alias. Do not use in new APIs/UI for create-org. |
| **Membership** | User row linked to IdP subject + one org (existing multi-membership model stays for Hosted / licensed multi-org). |

### 1.3 Entitlement claims (target shape)

```json
{
  "iss": "envsync-license-server",
  "sub": "<install_fingerprint>",
  "edition": "enterprise",
  "exp": 1735689600,
  "features": ["management", "oidc", "saml", "rotation", "dynamic_secrets", "log_forwarding", "integrations"],
  "max_orgs": 1,
  "seats": 50,
  "addons": []
}
```

Rules:

- **OSS:** no claims; hardcode `max_orgs=1`; no EE features.  
- **Self-host Enterprise without multi-org claim:** `max_orgs=1`.  
- **Self-host Enterprise with multi-org:** `max_orgs=N` or feature `multi_org`.  
- **Hosted:** multi-org governed by platform policy / billing, not self-host license file (mode=`hosted` bypasses self-host multi-org license gate for org create, or uses internal entitlement service—implementation detail Phase 4).

### 1.4 Package / directory target (dual license)

```text
packages/
  envsync-kernel/           # MIT: errors, env base, db driver, auth types, FGA/KMS clients
  envsync-core-domain/      # MIT: org/app/secret/user domain services + core migrations
  envsync-api/              # MIT: core Hono app only
  envsync-enterprise/       # PROPRIETARY: management API modules, EE services, EE migrations
  envsync-management-api/   # PROPRIETARY entrypoint packaging enterprise
  envsync-enterprise-web/   # PROPRIETARY: WebModule[] + EE pages (integrations, license, providers)
  envsync-ui/               # MIT: design tokens, tailwind preset, optional shared primitives
  deploy-core/              # MIT shared deploy primitives
  deploy/                   # MIT public OSS deploy CLI
  deploy-enterprise/        # PROPRIETARY private registry (rename from deploy-cli)
apps/
  envsync-web/              # MIT shell — core modules; EE via package injection at build
  envsync-landing/          # Hosted-only; consumes envsync-ui tokens
  # envsync-management-web  # REMOVED — absorbed into envsync-enterprise-web + shell
```

Root LICENSE: MIT for non-enterprise paths; enterprise paths under proprietary enterprise license (PostHog/Coder pattern).

---

### 1.5 License topology (D20–D21)

```text
[Private license-server]  --signs-->  entitlement JWT / cert bundle
         ^                                    |
         | admin generate                     v
    EnvSync sales                    /etc/envsync/license/   (customer install)
                                              |
                                              v
                              API + management verify with PUBLIC key in binary
                                              |
                                              v
                                    Entitlements cache (DB/Redis) — not authority
```

| Path | Behavior |
|------|----------|
| Online activate | CLI/API → license-server with key + fingerprint → write entitlement file |
| Air-gap | Customer sends fingerprint → EnvSync issues file → `license add -f` |
| Runtime | Verify signature, `exp`, fingerprint, `features[]`, `max_orgs` |

### 1.6 Threat model summary (D22)

| Attacker | Outcome we design for |
|----------|------------------------|
| Flip `ENVSYNC_EDITION` / SQL `license_state` | **Blocked** after Phase 4 (crypto verify) |
| Stolen key, second install | Mitigated by activations + fingerprint |
| Comment out `requireFeature` / rebuild | **Possible** (open-core); legal + private deploy package raise friction |
| Resell cracked fork | Trademark/ToS/support—not DRM |

---

## 2. Current → target gaps (summary)

| Area | Today | Target |
|------|-------|--------|
| Multi-org self-host EE | Open if edition=enterprise | Licensed + **CLI only**; default 1 |
| create-workspace web | Enterprise edition gate | **Hosted only**; self-host always deny |
| Public signup | Unauthenticated always | Hosted only (landing + API) |
| First org self-host | Often landing/signup-shaped | OSS: boot/CLI; EE: CLI bootstrap |
| Landing | Required enterprise self-host topology | Hosted only |
| OSS deploy | Spawns monorepo deploy-cli | Standalone OSS lifecycle |
| Enterprise deploy | Public package, enterprise defaults | Private package, distinct product |
| Management API | Thin re-export of core | Real package on kernel + enterprise |
| License | Env edition + soft lock | File + verified entitlements + requireFeature |
| Deployment identity | Inferred from edition/flags | `ENVSYNC_DEPLOYMENT_MODE` |
| management-web SPA | Separate app + merge into `/manage` | **Deleted**; EE modules in dashboard |
| FE EE modules | In-tree pages + Vite stub | `envsync-enterprise-web` package |
| Design tokens | Duplicated web/landing CSS | `envsync-ui` package |

---

## 3. Multi-phase plan

---

### Phase 0 — Decision freeze & instrumentation

**Goal:** Codify **all** locked decisions (D1–D22); stop new piggybacks; inventory for Phase 1.  
**Duration:** ~3–5 days  
**Depends on:** Nothing  
**Safe to start:** **Yes** — docs/inventory only; no production behavior change required to exit.

#### Direction

- This plan file is the ADR-level reference; link from `AGENTS.md` or `CONTRIBUTING.md`.  
- PR checklist: “Does this piggyback product A on B?” + “Does this violate org-create channel matrix §1.1a?”  
- Inventory every org-create path and tag target channel/disposition.  
- Inventory management-web screens + token duplication (feeds 5c / envsync-ui).  

#### Work items

| ID | Work | Owner area |
|----|------|------------|
| 0.1 | ADR short form: D1–D22 + invariants + §1.1a matrix | Docs |
| 0.2 | Inventory: every code path that creates an org (file, auth, disposition Phase 1) | API |
| 0.3 | Inventory: deploy edition branches, management imports, spawn shims | Deploy / API |
| 0.4 | Inventory: management-web routes → future dashboard module map | FE |
| 0.5 | Inventory: CSS/token duplication web vs landing | FE |
| 0.6 | PR template: piggyback + channel matrix checks | Process |
| 0.7 | Reserve env names: `ENVSYNC_DEPLOYMENT_MODE`, document interim `ENVSYNC_MAX_ORGS` (CLI-only later) | API |
| 0.8 | Link this plan from Agents.md “Programs” or docs index | Docs |

#### Acceptance criteria

- [ ] Plan path `docs/plans/2026-08-no-piggyback-program.md` linked from repo docs entrypoint.  
- [ ] ADR or plan §0 lists **D1–D22** (not only D1–D8).  
- [ ] Org-create inventory table exists with columns: path, auth, today, target channel, phase.  
- [ ] management-web screen inventory exists.  
- [ ] PR template includes no-piggyback + §1.1a checks.  
- [ ] No new EE modules added under core without enterprise-package note.  

#### Exit gate

Phase 1 coding may start when 0.1–0.3 and 0.6–0.7 are done (0.4–0.5 can finish in parallel).

---

### Phase 1 — Deployment mode + tenancy hard gates (P0)

**Goal:** Runtime policy matches **D1, D2, D3, D8, D13–D18** for **HTTP/API/UI behavior**.  
**Duration:** ~1–2 weeks  
**Depends on:** Phase 0 exit  
**Safe to start:** **Yes, after Phase 0 exit**, using this section only (do not use older “web create if entitled” wording).

#### Direction

Introduce `ENVSYNC_DEPLOYMENT_MODE` and a single policy module (extend `EditionPolicyService` or add `DeploymentPolicyService` / `OrgProvisioningPolicy`):

```text
assertCanProvisionOrg({ source, orgCount, deploymentMode, edition, maxOrgs })
assertPublicOrgSignupEnabled()
```

**Authoritative allow table for Phase 1 (HTTP):**

| Caller `source` | Hosted | Self-host OSS | Self-host EE |
|-----------------|--------|---------------|--------------|
| `hosted_signup` (onboarding org*) | Allow | Deny | Deny |
| `hosted_dashboard` (create-workspace → createOrganization) | Allow | **Deny** | **Deny** |
| `selfhost_bootstrap` / `selfhost_cli` | Deny (N/A) | Allow if orgCount=0 | Allow if orgCount &lt; maxOrgs |

**Phase 1 interim `max_orgs`:**

| Mode | max_orgs |
|------|----------|
| selfhosted + oss | **1** always |
| selfhosted + enterprise | **1** always until Phase 4 (or support-only `ENVSYNC_MAX_ORGS` for stranded multi-org installs—**CLI path only** when Phase 1b exists) |
| hosted | unlimited / platform |

**Critical:** Self-host **web** must deny org create even if someone sets `ENVSYNC_MAX_ORGS=99`. Multi-org on self-host EE is **CLI + entitlement** (Phase 1b + 4), never cookie session.

#### Work items

| ID | Work |
|----|------|
| 1.1 | Add `ENVSYNC_DEPLOYMENT_MODE` to env schema + policy service |
| 1.2 | Central `assertCanProvisionOrg` / `assertPublicOrgSignupEnabled` used by **all** org provision entrypoints |
| 1.3 | Gate `POST/GET/PUT /api/onboarding/org*`: only hosted public signup; stable codes `PUBLIC_ORG_SIGNUP_DISABLED` |
| 1.4 | Gate `POST /api/auth/create-workspace`: **`deployment_mode=hosted` only**; deny all self-host with `ORG_CREATE_CHANNEL_FORBIDDEN` (or similar). Rename docs/OpenAPI toward `createOrganization` |
| 1.5 | Pass `source` through `OrgProvisioningService` / workspace provisioning; workspace path either deleted on self-host or hard-denied before provision |
| 1.6 | Deploy-core/cli **render**: self-host plans set `ENVSYNC_DEPLOYMENT_MODE=selfhosted`, `max_orgs=1` defaults |
| 1.7 | Hosted env samples: `ENVSYNC_DEPLOYMENT_MODE=hosted` |
| 1.8 | System status (+ whoami if useful): `deployment_mode`, `max_orgs`, `public_signup_enabled`, `can_create_organization` (**true only on hosted** for web), `org_create_channels` optional |
| 1.9 | Web: remove/hide create-workspace for non-hosted; Hosted label **Organization**; never show create on self-host even if enterprise edition |
| 1.10 | Rate-limit public onboarding when hosted signup enabled |
| 1.11 | Rename error `OSS_SINGLE_ORG_LIMIT_REACHED` → `ORG_LIMIT_REACHED` (keep alias) |
| 1.12 | Tests: mock matrix per §1.1a for HTTP paths; e2e hosted signup still green; e2e self-host create-workspace 403 |

#### Acceptance criteria

- [ ] Self-host OSS: `POST /onboarding/org` → 403 `PUBLIC_ORG_SIGNUP_DISABLED`.  
- [ ] Self-host OSS: `POST /auth/create-workspace` (authenticated) → 403 channel forbidden (not only org limit).  
- [ ] Self-host EE (default): same as OSS for both HTTP paths above.  
- [ ] Self-host EE: even with interim `ENVSYNC_MAX_ORGS>1`, **web** create-workspace still 403.  
- [ ] Hosted: public signup + dashboard create organization work in CI harness.  
- [ ] UI: no “Create workspace/organization” affordance when `deployment_mode=selfhosted`.  
- [ ] Deploy-generated runtime env for OSS/EE self-host includes `ENVSYNC_DEPLOYMENT_MODE=selfhosted`.  
- [ ] All org provision code paths call central policy (inventory from 0.2 checked off).  
- [ ] Error codes not OSS-only when EE self-host hits limit.  

#### Exit gate

HTTP surface matches §1.1a for hosted vs self-host. CLI first-org may still be incomplete (Phase 1b)—document temporary bootstrap path (existing `create-dev-user` / `bootstrap-org` scripts) as interim operator path if needed.

#### Risks

- Existing multi-org self-host: migration note; support `ENVSYNC_MAX_ORGS` only for **CLI** after 1b.  
- E2E that used enterprise web multi-org must run as **hosted** or wait for CLI e2e.  

---

### Phase 1b — Self-host first org + EE multi-org via deploy CLI (P0 product)

**Goal:** D14–D16, D19 — operator org create without web.  
**Duration:** ~1–2 weeks  
**Depends on:** Phase 1 (policy + deployment_mode)  
**Safe to start:** After Phase 1 API gates land (can overlap late Phase 1).

#### Direction

| Edition | CLI product | Commands |
|---------|-------------|----------|
| OSS | `@envsync-cloud/deploy` | Bootstrap end prompt **and/or** `envsync-deploy org create` when `org_count=0` only |
| EE | `envsync-deploy-enterprise` | Bootstrap **must** prompt first org+admin; `org create` for further orgs only if `max_orgs` allows |

Implementation options (pick one in 1b.0 spike, default recommended):

1. **Recommended:** CLI calls **setup/operator API** with bootstrap token written at deploy (`/etc/envsync/bootstrap.token` or env), token revoked after first org or rotated.  
2. CLI runs local provision script against DB (no HTTP)—faster isolation, harder remote automation.  

Do **not** use normal user access_token cookie for self-host org create.

#### Work items

| ID | Work |
|----|------|
| 1b.0 | Spike: operator token API vs local DB provision; write ADR choice |
| 1b.1 | OSS deploy: bootstrap interactive first org + admin (or document + implement `org create`) |
| 1b.2 | EE deploy: bootstrap **requires** first org step before “ready” |
| 1b.3 | EE deploy: `org create` checks org count vs max_orgs (interim env until Phase 4 claims) |
| 1b.4 | If operator API: routes not on public browser CORS allowlist; require setup token header |
| 1b.5 | Docs: SELFHOSTING first-org; enterprise further orgs CLI-only |
| 1b.6 | Tests: CLI/org provision integration or scripted smoke |

#### Acceptance criteria

- [ ] Fresh OSS self-host can create **exactly one** org via boot/CLI without landing or web signup.  
- [ ] Fresh EE self-host bootstrap creates first org via CLI; stack not “ready” without it (or health warns clearly).  
- [ ] EE CLI second org denied when max_orgs=1.  
- [ ] No browser session on self-host can create org (regression from Phase 1).  
- [ ] Operator credential is not the Keycloak end-user login cookie.  

#### Exit gate

Self-host org lifecycle is operator-CLI-complete for OSS (1 org) and EE (1 org default).

---
---

### Phase 2 — Landing out of self-host + invite accept on dashboard

**Goal:** D3 complete operationally.  
**Duration:** ~1–2 weeks  
**Depends on:** Phase 1 (signup gated); can parallel late Phase 1  

#### Direction

- Landing = Hosted Cloudflare only.  
- User (and org-accept if hosted) invite UX on `envsync-web`.  
- Self-host email links use `DASHBOARD_URL`.  

#### Work items

| ID | Work |
|----|------|
| 2.1 | Routes on `envsync-web`: accept user invite; hosted-only accept org invite (or keep org accept only on landing for hosted) |
| 2.2 | API mail links: self-host → dashboard; hosted org signup → landing |
| 2.3 | Fix InvitationsPanel clipboard (no strip-`app.` hack; use system config) |
| 2.4 | deploy-core: landing **not** required for enterprise self-host; default **off** |
| 2.5 | Health/status: omit landing when disabled |
| 2.6 | SELFHOSTING.md DNS: remove root landing requirement |
| 2.7 | CORS: empty landing origin filtered (already) |
| 2.8 | Landing stays in monorepo for Hosted deploys only |

#### Acceptance criteria

- [ ] Enterprise self-host stack deploys and passes health **without** landing service.  
- [ ] User invite email on self-host opens dashboard accept flow end-to-end.  
- [ ] Hosted landing signup + org accept still pass e2e.  
- [ ] No self-host docs require apex marketing site.  

#### Exit gate

Landing removed from required self-host topology in plan + render + docs.

---

### Phase 3 — Deploy CLI product split (no packaging piggyback)

**Goal:** D4 complete.  
**Duration:** ~2–3 weeks  
**Depends on:** Phase 1 env defaults (can start in parallel after 1.5)  

#### Direction

| Package | Registry | Bin | Lifecycle |
|---------|----------|-----|-----------|
| `@envsync-cloud/deploy` | Public npm | `envsync-deploy` | Full OSS Swarm lifecycle |
| `@envsync-cloud/deploy-enterprise` (ex deploy-cli) | **Private** (GH packages / private npm) | `envsync-deploy-enterprise` | Enterprise topology + license |
| `@envsync-cloud/deploy-core` | Public | library | Shared plan/render primitives only |

**Forbidden:** OSS package spawning enterprise sources or monorepo paths.

#### Work items

| ID | Work |
|----|------|
| 3.1 | Implement full OSS lifecycle inside `packages/deploy` (extract from deploy-cli OSS paths) |
| 3.2 | Remove spawnSync monorepo shim; fail with clear error if miswired |
| 3.3 | Rename/rebrand enterprise package; private publish in release.yml |
| 3.4 | Distinct bin names; no dual `envsync-deploy` collision |
| 3.5 | OSS defaults: edition=oss, no management/landing/license mounts; ship Phase 1b `org create` / bootstrap first-org |
| 3.6 | Enterprise CLI defaults: edition=enterprise, management on, landing off (Phase 2), license on; bootstrap first-org + `org create` under max_orgs |
| 3.7 | Image matrix: OSS → `envsync-web-oss-static`; EE → enterprise web |
| 3.8 | Align plan (deploy-core) with render (single source of truth for services) |
| 3.9 | Smoke: `selfhost:smoke:oss` on packed OSS dist only |
| 3.10 | Docs: SELFHOSTING → OSS package; enterprise runbook separate + private access |

#### Acceptance criteria

- [ ] `npm pack` OSS tarball + install in clean dir runs `bootstrap`/`deploy`/`health` against fixture (or documented smoke).  
- [ ] Zero references from OSS dist to `packages/deploy-cli` or `deploy-enterprise` source paths.  
- [ ] Enterprise package not published `access: public` (or publish job removed).  
- [ ] OSS topology never pulls management-api or landing images.  
- [ ] Enterprise topology includes management-api + license volume; landing absent by default.  
- [ ] Docs match package names and registries.  

#### Exit gate

Public operators never need enterprise CLI for OSS self-host.

---

### Phase 4 — Licensing: entitlements (Coder-style)

**Goal:** D7 complete; unlock licensed multi-org for self-host EE (D1).  
**Duration:** ~3–5 weeks  
**Depends on:** Phase 1 policy hooks; private license-server  

#### Direction

- License server (private) **signs** entitlement JWT (Ed25519/ES256) and/or short-lived certs with feature claims.  
- Product embeds **public key only**; verifies on enforcement path.  
- `requireFeature("saml")` / `assertMaxOrgs` read entitlements—not env edition alone.  
- Grace period after expiry for features.  
- Multi-org on self-host EE: only if `max_orgs > 1` or `multi_org` in verified claims.  

#### Work items

| ID | Work |
|----|------|
| 4.1 | Entitlement claim schema + versioning |
| 4.2 | License-server: issue/activate returns signed entitlement; admin generate key |
| 4.3 | API: verify signature, fingerprint, exp; cache last good entitlement with grace |
| 4.4 | Replace/augment lease DB-status authority with crypto verify |
| 4.5 | `requireFeature` middleware on EE routes (OIDC, SAML, rotation, dyn secrets, integrations, …) |
| 4.6 | Wire `max_orgs` from claims into Phase 1 / 1b provision gates (**CLI only** on self-host; web still hosted-only) |
| 4.7 | Pin public key in API assets; ignore server-supplied root for trust (cert mode) |
| 4.8 | Deploy enterprise: mount/install entitlement; document air-gap |
| 4.9 | Management heartbeat refreshes entitlement; core enforces same verified state |
| 4.10 | E2E: invalid entitlement → feature 403; multi-org claim allows N orgs; expired grace then lock features |
| 4.11 | Deprecate “edition env alone unlocks EE” |

#### Acceptance criteria

- [ ] `ENVSYNC_EDITION=enterprise` + `LICENSE_ENFORCEMENT` path without valid signature → EE routes 403, not full silent unlock.  
- [ ] Forged DB `license_state.status=active` without valid JWT/cert → still not entitled.  
- [ ] Self-host EE with `max_orgs=3` claim: **CLI** can create 3 orgs; 4th rejected; **web still 403**.  
- [ ] Self-host EE with default/no multi-org claim: still max 1 org.  
- [ ] Air-gapped install validates offline with public key (documented).  
- [ ] Hosted multi-org does not depend on customer-side license file (mode=hosted).  
- [ ] Threat model (D22) documented in SELFHOSTING enterprise / security notes.  

#### Exit gate

Licensed multi-org (D1) is live; soft env bypass closed for EE features.

---

### Phase 5 — Management API real product (kernel split)

**Goal:** D5 complete.  
**Duration:** ~4–8 weeks (can start after Phase 1; finish after/with Phase 4 features list)  
**Depends on:** Soft dependency on Phase 4 for feature gates inside enterprise package  

#### Direction

```text
envsync-kernel + envsync-core-domain
        ↑                    ↑
   envsync-api          envsync-enterprise
   (core process)       ↑
                   envsync-management-api (process)
```

- No `../../envsync-api/src` imports.  
- Core OSS image does not contain enterprise engines.  
- Shared domain services as library for sync workers.  

#### Work items

| ID | Work |
|----|------|
| 5.1 | Extract kernel (errors, env composition hooks, telemetry helpers, clients) |
| 5.2 | Extract core-domain (org/app/secret/user services needed by EE sync) |
| 5.3 | Move management modules + EE services to `envsync-enterprise` |
| 5.4 | Split migrations: core vs enterprise streams; management migrates EE |
| 5.5 | Management package depends on enterprise + kernel; entrypoint clean |
| 5.6 | Core `loadApiModules("core")` never imports enterprise package |
| 5.7 | OSS Docker build fails if enterprise in dependency graph |
| 5.8 | Dual-license LICENSE files + root LICENSE carve-out (D6) |
| 5.9 | Web: enterprise UI modules only resolve when EE present (existing alias → harden) |
| 5.10 | SDK generation still split; CI generates both OpenAPIs |

#### Acceptance criteria

- [ ] `rg` / CI: no relative path from management-api into core `src/`.  
- [ ] OSS API container/SBOM does not include enterprise package sources.  
- [ ] Management process still runs license heartbeat + enterprise sync.  
- [ ] Core process serves only core modules; health reports surface.  
- [ ] Dual-license notice present and accurate for `envsync-enterprise/`.  
- [ ] Existing e2e enterprise flows green on split packages.  

#### Exit gate

Management is a product dependency graph, not a surface flag on core.

---

### Phase 6 — Dual-license monorepo polish + naming (D6 + D2 language)

**Goal:** Legal and UX language match architecture.  
**Duration:** ~1–2 weeks  
**Depends on:** Phase 5 directory layout  

#### Work items

| ID | Work |
|----|------|
| 6.1 | Finalize root LICENSE dual-license text (PostHog-style) |
| 6.2 | `enterprise/LICENSE` proprietary terms (production use requires subscription) |
| 6.3 | CONTRIBUTING / EDITIONING.md rewrite: public monorepo dual-license (not only private-superset) |
| 6.4 | API/OpenAPI: deprecate `createWorkspace` → `createOrganization` (compat alias period) |
| 6.5 | UI strings: Organization on Hosted; no “workspace” for multi-org |
| 6.6 | CLI Go: help text / docs alignment |
| 6.7 | Support matrix published (Hosted / OSS SH / EE SH) |

#### Acceptance criteria

- [ ] Legal review checklist completed (internal).  
- [ ] No primary UI path says “Create workspace” for org create.  
- [ ] EDITIONING.md matches dual-license monorepo (update private-superset as optional future).  
- [ ] Support matrix matches section 1.1.  

---

### Phase 7 — Hardening, deprecations, cleanup

**Goal:** Remove interim shims; debt paydown.  
**Duration:** Ongoing after Phase 5–6  

#### Work items

| ID | Work |
|----|------|
| 7.1 | Remove interim `ENVSYNC_MAX_ORGS` if fully replaced by claims |
| 7.2 | Remove dead deploy-cli duplicate renderers |
| 7.3 | Remove create-workspace alias after deprecation window |
| 7.4 | Optional: network policy templates (management private-only) |
| 7.5 | Optional later: browser BFF (out of program unless scheduled) |

#### Acceptance criteria

- [ ] No documented reliance on piggyback paths.  
- [ ] Deprecation window closed with changelog.  

---

## 4. Cross-phase dependency graph

```text
Phase 0 Decision freeze (D1–D22)
    │
    ▼
Phase 1 HTTP tenancy gates + deployment_mode
    │
    ├──────────► Phase 1b Self-host org via CLI / bootstrap
    │
    ├──────────► Phase 2 Landing / invites
    │
    ├──────────► Phase 3 Deploy CLI product split (includes packaging org CLI)
    │                 │
    │                 ▼
    └──────────► Phase 4 Entitlements (max_orgs for CLI multi-org)
                      │
                      ▼
               Phase 5 Kernel + management API package
                      │
                      ├─ 5b enterprise-web modules
                      ├─ 5c delete management-web
                      │
                      ▼
               Phase 6 Dual-license + naming
                      │
                      ▼
               Phase 7 Cleanup

Parallel anytime after Phase 0: envsync-ui tokens (D12)
```

**Parallelism:** 1b after 1; 2 ∥ 3 after 1; `envsync-ui` early; 5b/5c with/after 5.

---

## 5. Test & release strategy

| Layer | What |
|-------|------|
| Unit | DeploymentPolicy / entitlement verify / max_orgs matrix |
| Mock API | All org-create paths reject/allow per mode |
| E2E self-host OSS | Single org, no landing, no management, signup 403 |
| E2E self-host EE | Management up; default 1 org; entitled multi-org optional suite |
| E2E hosted | Signup, multi-org, landing |
| Pack smoke | OSS deploy tarball lifecycle |
| Image CI | OSS image graph excludes enterprise |
| License e2e | Keep hosted license server; add offline JWT fixture CA for unit (not prod key) |

Release trains:

1. **Train A (Phase 1 + 1b + 2):** “Self-host is not SaaS; orgs via operator CLI; landing Hosted-only”  
2. **Train B (Phase 3):** “OSS install is a real product; EE deploy private”  
3. **Train C (Phase 4):** “Licensed enterprise + CLI multi-org by claim”  
4. **Train D (Phase 5–6):** “Enterprise package + dual license + one dashboard + envsync-ui”  

---

## 6. Explicit non-goals (this program)

See also **§0.5 (N1–N5)**.

- Next.js Server Actions–only dashboard rewrite; “no public APIs” for CLI/SDK  
- Nested workspace entity under org (future product, not multi-org alias)  
- Hard anti-piracy / DRM beyond honest entitlements (D22)  
- Merging core + management into one public process  
- Keeping marketing landing in self-host Swarm  
- **Keeping `apps/envsync-management-web` as a long-term product** (D11)  
- Self-host dashboard org factory (even for licensed multi-org—**CLI only**, D16–D17)  

---

## 6A. Frontend: module injection, kill management-web, `envsync-ui` (Amendment)

> **Status:** Added after product review. Not in original D1–D8 questionnaire; now program scope.  
> **Principle:** One primary dashboard shell; EE via real package injection; shared design system package; no second orphan SPA.

### 6A.1 Current state (problem)

| Mechanism | Today | Issue |
|-----------|--------|--------|
| FE module injection | `core-modules` + Vite alias `@enterprise-modules` → `enterprise-modules.ts` vs `.stub.ts` based on `VITE_SERVER_LICENSE` | **Works**, but EE routes/pages still live **inside** `apps/envsync-web` (not a real package). `external-modules.ts` is empty aspirational hook. |
| Runtime gate | `isEnterpriseDashboard` also filters modules | Build-time stub + runtime check dual path; easy to drift |
| `envsync-management-web` | Separate Vite SPA (~1.5k LOC): license activate, provider connections, org secrets, sync runs | Stale second product: different styles, no design system, merged via `scripts/merge-management-web-dist.ts` into `envsync-web/dist/manage` |
| Design tokens | Duplicated CSS variables + Tailwind themes in `envsync-web` and `envsync-landing` (and ad-hoc CSS in management-web) | Drift; no single token source |

**Product call:** `envsync-management-web` is **not required**. EE operator UX (license, providers, sync) must live as **injected modules of `envsync-web`** (or a thin enterprise package consumed by the shell)—not a separate app under `/manage`.

### 6A.2 Target FE architecture

```text
packages/envsync-ui/              # MIT — design tokens, tailwind preset, optional primitives
        ↑
apps/envsync-web/                 # MIT shell — core modules only in OSS build
        ↑ optional dependency (enterprise build only)
packages/envsync-enterprise-web/  # PROPRIETARY — WebModule[] + pages for integrations,
                                  # license settings, providers, sync (absorb management-web)
apps/envsync-landing/             # Hosted only — depends on envsync-ui tokens, not full app chrome
```

**Module injection (aligned with backend dual-license):**

| Build | Modules loaded |
|-------|----------------|
| OSS (`VITE_SERVER_LICENSE=oss` or no EE package) | `coreWebModules` only; stub/empty enterprise |
| Enterprise / Hosted | `coreWebModules` + `enterpriseWebModules` from **`@envsync-cloud/envsync-enterprise-web`** (or workspace package) |

Rules:

1. **No piggyback:** enterprise pages do not remain as first-class trees only “hidden” by env while still in OSS graph—OSS build must not import enterprise package (same as API).  
2. **Vite/tsconfig:** enterprise build resolves real package; OSS build resolves stub package or `optionalDependencies` omitted.  
3. **Deprecate** in-tree `enterprise-modules.ts` that points at `@/pages/ProjectIntegrations` once package exists—move those pages into enterprise-web package.  
4. **`external-modules.ts`:** either delete or become the single seam that re-exports enterprise package (one mechanism, not three).  

### 6A.3 Kill `envsync-management-web`

| Step | Work |
|------|------|
| Inventory | Map every screen in management-web → dashboard route under Settings / Organisation / License |
| Port | Rebuild in dashboard design system (via `envsync-ui`) as EE modules |
| Wire | Calls stay on management API SDK; shell is still envsync-web session cookies |
| Remove | App package, turbo `envsync-management-web#dev`, `merge-management-web-dist.ts`, release/deploy “merge manage subtree” |
| Docs | AGENTS.md / EDITIONING: no separate management SPA |

**Acceptance:**

- [ ] Zero workspace package `apps/envsync-management-web`  
- [ ] Zero `dist/manage` merge step in release  
- [ ] License + provider + sync UX reachable from enterprise dashboard navigation  
- [ ] OSS dashboard build has no management-web dependency and no EE provider pages in graph  

### 6A.4 Package `envsync-ui` (common design tokens)

**Name:** `@envsync-cloud/envsync-ui` (or `packages/envsync-ui`)  
**License:** MIT (shared by OSS + landing + EE)  
**Scope (v1 — tokens first, expand deliberately):**

| Include in v1 | Defer |
|---------------|--------|
| CSS variables (color, radius, typography, spacing semantic tokens) | Full component library rewrite |
| Tailwind preset / plugin consuming tokens | Heavy data-table / app-specific patterns |
| Shared fonts references | Business logic hooks |
| Optional: thin primitives (Button, Input) if both apps need them without forking shadcn | Entire shadcn dump day one |

**Consumers:**

- `envsync-web` — primary  
- `envsync-landing` — marketing aligned brand  
- Enterprise web modules — same chrome  
- **Not** a reason to keep management-web  

**Non-goals for `envsync-ui`:**

- Not an app  
- Not Next-specific  
- Not a place for API clients  

### 6A.5 Phase mapping (FE workstream)

| Phase | FE work |
|-------|---------|
| **0** | Inventory management-web routes; inventory token duplication web vs landing |
| **2b / parallel** | Create `packages/envsync-ui` tokens + wire web + landing (low risk) |
| **5b (with API enterprise package)** | Extract `envsync-enterprise-web` modules; move integrations pages out of core web |
| **5c** | Port management-web → enterprise-web modules; delete app + merge script |
| **6** | Dual-license enterprise-web; docs; CI OSS graph excludes enterprise-web |

Can start **`envsync-ui` early** (after Phase 0) without blocking tenancy gates.  
**Delete management-web** only after feature parity in dashboard EE modules (depends on enterprise-web package existence).

### 6A.6 Locked FE decisions (this amendment)

| # | Decision |
|---|----------|
| D9 | **One dashboard shell** (`envsync-web`). No long-term separate management SPA. |
| D10 | **EE FE = package injection** (`envsync-enterprise-web` modules), not only Vite stub files beside core pages. |
| D11 | **`envsync-management-web` deprecated → delete** after absorb. |
| D12 | **`packages/envsync-ui`** owns shared design tokens (+ optional shared primitives). |

---

## 7. Communication

| Audience | Message |
|----------|---------|
| OSS self-host | One org; OSS deploy package; free core |
| EE self-host | Licensed EE features; one org default; multi-org only if your license includes it; no public signup |
| Hosted | Multi-org SaaS; organizations (not “workspaces”); marketing site separate |
| Internal | No piggyback PRs; shared libs only |

---

## 8. Open implementation defaults (not re-deciding product)

These are **engineering defaults** consistent with locked decisions—change only with PM note:

| Topic | Default |
|-------|---------|
| Self-host EE multi-org before Phase 4 | **Off** (`max_orgs=1`) |
| Hosted multi-org license file | Not required; platform mode |
| Enterprise deploy bin name | `envsync-deploy-enterprise` |
| Enterprise package name | `@envsync-cloud/deploy-enterprise` (private) |
| EE source dir name | `packages/envsync-enterprise` |
| Entitlement alg | Ed25519 JWT (Coder-like) preferred |
| createWorkspace API | Compat alias ≥1 minor; docs use createOrganization |
| Interim override for stranded multi-org SH customers | Support-only `ENVSYNC_MAX_ORGS` for **CLI** until Phase 4 claims |
| Web create-org on self-host | **Never** (even if MAX_ORGS set) |
| Operator org create | Deploy CLI + setup token / local provision (1b.0) |
| License install path | `/etc/envsync/license/` |
| management-web | Delete after 5c parity |

---

## 9. Definition of Done (program)

Program complete when:

1. All Phase 0–6 (+1b, 5b, 5c) acceptance criteria checked.  
2. **D1–D22** observable in behavior and packaging.  
3. No OSS lifecycle depends on enterprise CLI.  
4. No management API is a core re-export.  
5. No self-host requires landing.  
6. EE features require verified entitlements.  
7. Self-host multi-org only via **license claims + CLI** (never web).  
8. Dual-license monorepo documented and CI-enforced for package boundaries.  
9. No `envsync-management-web` app; EE UI via enterprise-web module injection only.  
10. `envsync-ui` is the single source of design tokens for web + landing.  
11. OSS web build dependency graph excludes `envsync-enterprise-web`.  
12. Hosted signup remains landing + hosted-gated API only.  
13. Threat model (D22) documented for operators.  

---

## 10. Safe to start coding?

| Phase | Safe as written? | Condition |
|-------|------------------|-----------|
| **Phase 0** | **Yes** | Now |
| **Phase 1** | **Yes** | After Phase 0 exit; implement **this** § Phase 1 (web create-org **hosted-only**, not “self-host if entitled”) |
| **Phase 1b** | **Yes** | After Phase 1 gates; need 1b.0 operator-auth choice |
| **Phase 2+** | After Train A foundations | Per dependency graph |

**Do not start Phase 1 from pre-amendment drafts** that allowed `create-workspace` on self-host enterprise.

---

## 11. Suggested first sprint (kickoff)

1. **Phase 0** — link plan, ADR/checklist D1–D22, org-create inventory, PR template  
2. **Phase 1.1–1.5** — `DEPLOYMENT_MODE` + central policy + gate onboarding org* + gate create-workspace to hosted only  
3. **Phase 1.8–1.9** — system status flags + remove self-host create-workspace UI  
4. **Phase 1.6** — deploy render `ENVSYNC_DEPLOYMENT_MODE=selfhosted`  
5. **Start Phase 1b.0** spike (operator token vs local provision)  

Optional parallel: scaffold `packages/envsync-ui` token export (D12)—does not block Train A.

Do **not** start Phase 5 big-bang until Train A ships.
