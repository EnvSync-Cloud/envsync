# ADR 0001: No-piggyback program (tenancy, deploy, EE, licensing)

**Status:** Accepted  
**Date:** 2026-08-01  
**Branch track:** `feat/the-big-update` → phase branches `feat/the-big-update-pN`  
**Full program plan:** [docs/plans/2026-08-no-piggyback-program.md](../plans/2026-08-no-piggyback-program.md)

## Context

EnvSync mixed Hosted multi-tenant SaaS behavior with self-host installs, edition flags with real product packages, and UI “workspaces” that are multi-org creates. Deploy OSS CLI spawned enterprise CLI sources. Management API re-exported core. Licensing was soft.

## Decision

Adopt the locked decisions **D1–D22** and invariants in the program plan. Summary:

| Area | Decision |
|------|----------|
| Deployment mode | `ENVSYNC_DEPLOYMENT_MODE=hosted \| selfhosted` (D8) |
| Self-host OSS orgs | Always 1 (D1, D14) |
| Self-host EE orgs | Default 1; multi-org only licensed + **CLI** (D1, D15–D17) |
| Hosted orgs | Multi-org; public signup on landing + API (D13, D18) |
| Web create-org | **Hosted only** (D17–D18) |
| Landing | Hosted-only; never required on self-host (D3) |
| Deploy CLIs | Public OSS + private enterprise; no spawn shim (D4) |
| Management API | Real package + kernel (D5) |
| License | Coder-style entitlements; private issuer; install `/etc/envsync/license/` (D7, D20–D22) |
| Legal | Public monorepo dual-license EE dirs (D6) |
| FE shell | One `envsync-web`; delete `envsync-management-web`; EE via `envsync-enterprise-web` (D9–D11) |
| Design tokens | `packages/envsync-ui` (D12) |

### Org-create channel matrix (authoritative)

| Channel | Hosted | Self-host OSS | Self-host EE |
|---------|--------|---------------|--------------|
| Landing / onboarding org* | Allow | Deny | Deny |
| Web `POST /auth/create-workspace` | Allow | Deny | Deny |
| Deploy bootstrap / CLI `org create` | N/A | Allow if org_count=0 | Allow if under max_orgs + entitled |
| User invite accept | Join only | Join only | Join only |

## Consequences

- Phase 0: docs, inventories, reserve env vars (this branch).  
- Phase 1: HTTP gates.  
- Phase 1b: self-host CLI/bootstrap first org.  
- Later phases: deploy split, entitlements, package splits, FE injection.

## Non-goals

Next.js Server-Actions-only, hard DRM, nested workspaces, long-term management SPA (see plan §0.5).
