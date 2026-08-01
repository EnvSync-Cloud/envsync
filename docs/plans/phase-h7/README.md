# H7 — Deferred completion (H1 ops, H3 extraction, license-server)

**Branch:** `feat/the-big-update-h7`  
**Plan:** [../2026-08-post-program-hardening.md](../2026-08-post-program-hardening.md)

Closes remaining items after H1–H6:

| Deferred item | H7 delivery |
|---------------|-------------|
| H1.4–H1.5 Hosted secrets + smoke | [docs/HOSTED-CUTOVER.md](../../HOSTED-CUTOVER.md) + `scripts/hosted-cutover-check.ts` |
| H3.4+ EE extraction | OIDC/SAML/rotation/dyn-secret/log-forwarding + engines moved to `envsync-enterprise`; EE migrations owned there with API re-export shims |
| License-server deploy | [docs/LICENSE-SERVER-DEPLOY.md](../../LICENSE-SERVER-DEPLOY.md); local issuer tests when package present |

## H3 inventory (after H7)

### Owned by `envsync-enterprise`

| Surface | Path |
|---------|------|
| Integration/sync/provider/cert | `src/services/enterprise-*.ts` |
| OIDC / SAML / rotation / dynamic secrets / log-forwarding | `src/services/{oidc,saml,rotation,dynamic_secret,log-forwarding}.service.ts` |
| Rotation + dynamic secret engines | `src/services/*-engines/` |
| EE migrations | `src/migrations/019_*`, `022_oidc_*`, `023_*`, `024_*` |

### Core `envsync-api` (intentional)

| Surface | Why |
|---------|-----|
| Thin re-export shims for services + migrations | Imports + Kysely history without production package.json dep |
| `entitlement.service` / `license-state` | Core policy + hosted bypass |
| Controllers/routes loaders | Still loaded via management-route-loaders (HTTP surface) |
| Migrations 018/020/021 license core + multi-org | Shared product tables |

## Acceptance

- [x] Hosted cutover doc + automated repo check  
- [x] EE capability services physically under envsync-enterprise  
- [x] EE migrations owned by enterprise; core re-exports  
- [x] `check:boundaries` covers H7 services + migrations  
- [x] License-server deploy runbook  
- [ ] Live Hosted staging sign-off (ops; use HOSTED_SMOKE_*)  
- [ ] Production license-server non-fixture keys (ops)  

## Verify

```sh
bun run check:boundaries
bun run check:hosted-cutover
cd packages/envsync-api && bun test tests/mock/enterprise-sync.test.ts tests/mock/entitlement-lease.test.ts
# if local private tree:
# cd packages/license-server && bun test
```

## E2E pack (follow-up)

API + UI coverage for cutover invariants (branch `feat/the-big-update-e2e-pack`):

```sh
# API (after e2e-setup init)
cd packages/envsync-api && bun test tests/e2e/flows/create-organization.e2e.test.ts \
  --preload tests/e2e/helpers/real-setup.ts --timeout 60000

# UI (enterprise Vite default; harness up)
cd apps/envsync-web && bun run ui:features -- enterprise-routes
# or full regression: bun run ui:regression
```
