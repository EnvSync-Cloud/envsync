# Phase 1 — Deployment mode + tenancy hard gates

**Branch:** `feat/the-big-update-p1`  
**Base track:** `feat/the-big-update`  
**Program:** [../2026-08-no-piggyback-program.md](../2026-08-no-piggyback-program.md)

## What shipped

| ID | Change |
|----|--------|
| 1.1–1.2 | `EditionPolicyService`: `deployment_mode`, channel asserts, `getPolicySnapshot` |
| 1.3 | Onboarding org* gated with `PUBLIC_ORG_SIGNUP_DISABLED` |
| 1.4 | `POST /auth/create-workspace` hosted-only → `ORG_CREATE_CHANNEL_FORBIDDEN` on self-host |
| 1.5 | Provision paths take `source`; workspace → `hosted_dashboard` |
| 1.6 | Deploy render / deploy-core: `ENVSYNC_DEPLOYMENT_MODE=selfhosted`, landing off, max_orgs=1 |
| 1.7 | `.env.example` default `ENVSYNC_DEPLOYMENT_MODE=hosted` for local SaaS-like dev |
| 1.8 | System status + whoami policy fields |
| 1.9 | Web: hide create-org on self-host; Hosted label “Organization” |
| 1.11 | Error code `ORG_LIMIT_REACHED` (replaces OSS-only code for new throws) |
| 1.12 | Unit tests: `edition-policy.test.ts`; mock org-provisioning matrix (DB when available) |

## Not in this phase

- Phase 1b: formal deploy CLI `org create` / bootstrap first-org UX  
- Phase 2: remove landing service from EE topology entirely  
- Rate-limit public signup (optional follow-up)  

## Interim operator path (self-host first org)

Until 1b: `bun run packages/envsync-api/scripts/cli.ts bootstrap-org` / `create-dev-user` with source mapped to `dev`.

## Acceptance (Phase 1)

- [x] Self-host channels deny web + public signup (policy + controllers)  
- [x] Self-host deploy env sets `deployment_mode=selfhosted`  
- [x] Hosted local default still multi-tenant capable (`hosted` in .env.example)  
- [x] UI create-org gated via `canCreateOrganizationInUi`  
- [ ] Full mock auth HTTP suite (requires test DB up) — run when postgres test DB available  
