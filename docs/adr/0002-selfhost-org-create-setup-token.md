# ADR 0002: Self-host org create via setup token API

**Status:** Accepted  
**Date:** 2026-08-01  
**Phase:** 1b (`feat/the-big-update-p1b`)  
**Program:** [docs/plans/2026-08-no-piggyback-program.md](../plans/2026-08-no-piggyback-program.md)

## Context

Self-host must create the first organization (and further orgs when licensed) without public signup or dashboard session. Phase 1b needs an operator channel.

## Options

1. **Setup token HTTP API** — deploy writes `ENVSYNC_SETUP_TOKEN`; CLI calls `POST /api/setup/org` with `X-EnvSync-Setup-Token`.  
2. **Local DB provision from CLI** — deploy-cli exec into API container / talk to Postgres directly.

## Decision

**Option 1 (setup token API).**

Reasons:

- Reuses `OrgProvisioningService` and channel policy (`selfhost_bootstrap` / `selfhost_cli`).  
- No cookie/session; not Keycloak end-user auth.  
- Works after stack is up from the host (same as health checks against public API URL).  
- Setup routes only enabled when `ENVSYNC_SETUP_TOKEN` is configured; refused when not selfhosted.

## Consequences

- Token stored at `/etc/envsync/setup.token` and injected into API runtime env.  
- Commands: `envsync-deploy org create`, `org status`.  
- Bootstrap/deploy may prompt for first org when `org_count === 0`.  
- Health reports `first_org.ready` when `org_count >= 1`.  
- Token rotation is operator-managed (rewrite file + redeploy env).  

## Security notes

- Treat setup token like root password for the install.  
- Not for browser CORS product flows.  
- Does not replace Phase 4 license multi-org claims; only the transport for operator create.
