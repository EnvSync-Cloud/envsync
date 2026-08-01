# H4 — License issuer + self-host ops

**Branch:** `feat/the-big-update-h4`  
**Plan:** [../2026-08-post-program-hardening.md](../2026-08-post-program-hardening.md)

## Delivered

| ID | Change |
|----|--------|
| H4.1 | License-server `signed_lease` is **EdDSA entitlement JWT** when Ed25519 private key is configured (claims: `features`, `max_orgs`, `install_fingerprint`, `iss=envsync-license-server`) |
| H4.1 | License generate accepts `features` / `max_orgs`; store columns `features_json`, `max_orgs` |
| H4.1 | `/health` reports `entitlement_issuer_ready` |
| H4.2 | Hosted policy documented in [docs/LICENSE-RUNBOOK.md](../../LICENSE-RUNBOOK.md) |
| H4.3 | Self-host online/offline install flows documented |
| H4.4 | Unit tests: JWT verifies with API public key; hosted still bypasses without JWT |

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
- [ ] Live Hosted/prod license-server deploy with real keys (ops)  

## Verify

```sh
cd packages/license-server && bun test
cd packages/envsync-api && bun test tests/mock/entitlement-lease.test.ts
```
