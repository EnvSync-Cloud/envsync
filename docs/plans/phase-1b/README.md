# Phase 1b — Self-host org create via setup token

**Branch:** `feat/the-big-update-p1b`  
**ADR:** [docs/adr/0002-selfhost-org-create-setup-token.md](../../adr/0002-selfhost-org-create-setup-token.md)

## Decision (1b.0)

Operator **setup token HTTP API** (not local DB exec). See ADR 0002.

## Delivered

| ID | Work |
|----|------|
| API | `GET /api/setup/status`, `POST /api/setup/org` + `X-EnvSync-Setup-Token` |
| Middleware | Selfhosted-only + timing-safe token compare |
| Env | `ENVSYNC_SETUP_TOKEN` |
| Deploy | Token at `/etc/envsync/setup.token`, injected into runtime env |
| CLI | `envsync-deploy org create`, `org status` |
| Bootstrap | Prompts first org when TTY; EE warns if missing |
| Health | `first_org.ready` / human summary line |
| Docs | SELFHOSTING first-org section |
| Tests | `org-setup.test.ts`, `setup-token.test.ts` |

## Operator flow

```bash
envsync-deploy bootstrap   # generates setup.token; may prompt first org
envsync-deploy org create --name Acme --email admin@x.com --password '...'
envsync-deploy org status
envsync-deploy health --json
```

## Acceptance

- [x] Operator channel without browser session  
- [x] Self-host web still cannot create orgs (Phase 1)  
- [x] Setup API refused when not selfhosted  
- [x] max_orgs enforced via existing provision policy  
