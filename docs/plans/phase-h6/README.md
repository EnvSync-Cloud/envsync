# H6 — Docs, CI, ambiguity closure

**Branch:** `feat/the-big-update-h6`  
**Plan:** [../2026-08-post-program-hardening.md](../2026-08-post-program-hardening.md)

## Delivered

| ID | Change |
|----|--------|
| H6.1 | Program plan header: P0–P7 complete; H1–H6 hardening pointer; remaining ops called out |
| H6.2 | `docs/SUPPORT.md` Hosted vs self-host edition matrix + Hosted FE `build:hosted` note |
| H6.3 | CI: `deploy-fe` must not use `build:oss` (already in `check:boundaries`; reaffirmed) |
| H6.4 | CI: SDKs must not call `/auth/create-workspace` (already in `check:boundaries`; reaffirmed) |
| H6.5 | `CONTRIBUTING.md` footgun table: `ENVSYNC_EDITION` default + missing mode → hosted |
| H6.6 | `envsync-enterprise-web` moved to **devDependency** of `envsync-web`; boundary guard |

## Acceptance

- [x] Program + support + contributing docs describe edition matrix and Hosted FE rule  
- [x] `bun run check:boundaries` includes H1 FE/SDK guards + H6 web production-dep guard  
- [x] Proprietary EE web is not a production dependency of the MIT dashboard shell  

## Verify

```sh
bun run check:boundaries
```

## Out of scope (ops / later)

- H1.4–H1.5 Hosted secrets + staging smoke  
- H3.4+ further EE route/migration extraction  
- Private license-server deploy of EdDSA issuer  
