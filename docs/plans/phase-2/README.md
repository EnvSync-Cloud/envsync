# Phase 2 — Landing out of self-host + invite accept on dashboard

**Branch:** `feat/the-big-update-p2`  
**Program:** [../2026-08-no-piggyback-program.md](../2026-08-no-piggyback-program.md)

## Delivered

| ID | Change |
|----|--------|
| 2.1 | `envsync-web` standalone route `/onboarding/accept-user-invite/:invite_code` |
| 2.2 | `invite-links.ts`: self-host user invites → `DASHBOARD_URL`; hosted org/user → landing when set |
| 2.3 | `InvitationsPanel` copy link uses `runtimeConfig.appBaseUrl` (no strip-`app.` hack) |
| 2.4 | deploy-core: landing **not required** for EE; default `features.landing` off |
| 2.5 | deploy-cli stack/traefik: no `landing_nginx` / apex Host rule; health may show landing missing |
| 2.6 | SELFHOSTING already documents no marketing host |
| 2.8 | Landing app remains in monorepo for Hosted Cloudflare deploys |

## Hosted

- Landing still serves public signup + org invite accept.
- User invite emails may still use landing when `LANDING_PAGE_URL` is set; path is shared with dashboard.

## Self-host

- No landing service.
- User invite email + clipboard → `https://app.<domain>/onboarding/accept-user-invite/...`
- First org still via `envsync-deploy org create` (Phase 1b).

## Acceptance

- [x] Self-host topology omits landing by default  
- [x] User invite links target dashboard on self-host  
- [x] Dashboard has public accept-user-invite page  
- [x] Unit tests for invite-links + deploy render  
