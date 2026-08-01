# H4 — License issuer + self-host ops

**Branch:** `feat/the-big-update-h4`  
**Plan:** [../2026-08-post-program-hardening.md](../2026-08-post-program-hardening.md)

## Delivered

| ID | Change |
|----|--------|
| H4.1 | **Private** license-server: EdDSA entitlement JWT as `signed_lease` (see [PRIVATE_LICENSE_SERVER_PATCH.md](./PRIVATE_LICENSE_SERVER_PATCH.md); package is **gitignored** — apply to private repo) |
| H4.1 | Local monorepo scaffold (if present under `packages/license-server/`) was updated for EdDSA + features/max_orgs; not committed publicly |
| H4.2 | Hosted policy: [docs/LICENSE-RUNBOOK.md](../../LICENSE-RUNBOOK.md) |
| H4.3 | Self-host online/offline install flows documented |
| H4.4 | Public unit tests: JWT claim shape + feature gates; hosted bypass |

## Important

`packages/license-server` is listed in **root `.gitignore`**. Issuer code changes stay on the private license-server deployment path. Public monorepo ships **verify path + docs + tests**.

## Issuer key material

| Location | Role |
|----------|------|
| API `assets/license/envsync-entitlement-public.pem` | Verify only (ships with product) |
| License-server `LICENSE_ENTITLEMENT_PRIVATE_KEY_PEM` / `_FILE` | Sign only (private) |
| Monorepo fixture `tests/fixtures/license/entitlement-private.pem` | Dev; matches public key |

## Acceptance

- [x] EdDSA signed_lease claim shape matches EntitlementService  
- [x] Hosted multi-org does not require customer JWT (test)  
- [x] Self-host enforcement requires features under claims (test)  
- [x] Deploy runbook — [docs/LICENSE-SERVER-DEPLOY.md](../../LICENSE-SERVER-DEPLOY.md)  
- [ ] Live Hosted/prod license-server deploy with real keys (ops)  

## Verify

```sh
cd packages/license-server && bun test
cd packages/envsync-api && bun test tests/mock/entitlement-lease.test.ts
```
