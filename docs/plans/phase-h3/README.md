# H3 — EE physical extraction (open-core honesty)

**Branch:** `feat/the-big-update-h3`  
**Plan:** [../2026-08-post-program-hardening.md](../2026-08-post-program-hardening.md)

## H3.1 Inventory

### Moved into `envsync-enterprise` (this slice)

| Service | Notes |
|---------|--------|
| `enterprise-sync.service.ts` | Background worker |
| `enterprise-integration.service.ts` | Providers/bindings/secrets API backing |
| `enterprise-provider.service.ts` | Provider catalog |
| `enterprise-provider-sync.service.ts` | Provider push/pull engines |
| `enterprise-certificate-verifier.service.ts` | Offline license cert verify |

API keeps **re-export shims** at old `@/services/...` paths (monorepo relative, **no** `package.json` dependency).

### Remains in `envsync-api` (core-coupled)

| Surface | Why |
|---------|-----|
| `entitlement.service.ts` / types | Core policy + guards |
| `license-state.service.ts` / license client | Core license-lock middleware |
| OIDC / SAML / rotation / dynamic_secret / log-forwarding | Controllers/routes + engines still in api |
| EE HTTP routes/controllers | Loaded via management-route-loaders |
| Migrations 018+ enterprise tables | Split deferred (H3.4 later) |

## H3.2–H3.3 Delivered

- Services physically under `packages/envsync-enterprise/src/services/`
- Background: `startEnterpriseSyncWorker` owned by enterprise; management modules use it
- Loaders: `startEnterpriseSync` delegates to enterprise background

## Deferred

| ID | Work |
|----|------|
| H3.4 | Migration stream split |
| H3.x | Move OIDC/SAML/rotation/dyn-secret services + routes into enterprise |
| H3.6 | `envsync-core-domain` extraction |

## Acceptance (this slice)

- [x] Inventory documented  
- [x] Integration/sync services owned by envsync-enterprise  
- [x] envsync-api production deps still exclude envsync-enterprise  
- [x] Re-export shims keep existing imports working  
- [ ] Full EE route package ownership  

## Verify

```sh
bun run check:boundaries
test -f packages/envsync-enterprise/src/services/enterprise-sync.service.ts
head -5 packages/envsync-api/src/services/enterprise-sync.service.ts  # re-export
cd packages/envsync-api && bun test tests/mock/enterprise-sync.test.ts tests/mock/management-routes.test.ts
```
