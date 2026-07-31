# Phase 0 — Exit package

**Branch:** `feat/the-big-update-p0`  
**Base:** `feat/the-big-update`  
**Program:** [2026-08-no-piggyback-program.md](../2026-08-no-piggyback-program.md)

## Deliverables

| ID | Artifact | Status |
|----|----------|--------|
| 0.1 | [ADR 0001](../../adr/0001-no-piggyback-program.md) | Done |
| 0.2 | [org-create-inventory.md](./org-create-inventory.md) | Done |
| 0.3 | [deploy-and-management-inventory.md](./deploy-and-management-inventory.md) | Done |
| 0.4–0.5 | [frontend-inventory.md](./frontend-inventory.md) | Done |
| 0.6 | `.github/PULL_REQUEST_TEMPLATE.md` | Done |
| 0.7 | Env schema + `.env.example` reserved vars | Done |
| 0.8 | Links in `AGENTS.md`, `CONTRIBUTING.md` | Done |

## Acceptance criteria

- [x] Plan linked from repo entrypoints  
- [x] D1–D22 referenced via ADR + program plan  
- [x] Org-create inventory with path/auth/target/phase  
- [x] management-web inventory  
- [x] PR template includes no-piggyback + channel matrix  
- [x] `ENVSYNC_DEPLOYMENT_MODE` + `ENVSYNC_MAX_ORGS` reserved (no behavior change yet)  

## Exit gate

Phase 1 (`feat/the-big-update-p1`) may start: HTTP tenancy gates + `deployment_mode` wiring.
