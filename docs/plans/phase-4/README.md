# Phase 4 — Licensing: Coder-style entitlements

**Branch:** `feat/the-big-update-p4`  
**Base track:** `feat/the-big-update`  
**Program:** [../2026-08-no-piggyback-program.md](../2026-08-no-piggyback-program.md)

## Goal

D7 complete in the monorepo product surface: enterprise features and self-host multi-org limits are driven by **verified entitlement claims** (Ed25519 JWT), not `ENVSYNC_EDITION` alone when enforcement is on. Hosted multi-org stays platform-side (mode=`hosted` bypass).

## What shipped

| ID | Change |
|----|--------|
| 4.1 | Claim schema: `entitlement.types.ts` (`features[]`, `max_orgs`, `multi_org`, seats, ver) |
| 4.3 | `EntitlementService`: EdDSA JWT verify, fingerprint bind, grace (default 72h), test overrides, cache |
| 4.4 | `LicenseStateService`: verify JWT `signed_lease`; cert success → `applyCertificateClaims`; mode=`entitlement` |
| 4.5 | `enterpriseGuard(feature)` + `assertEntitled(feature)` on OIDC/SAML/rotation/dyn secrets/log-forward/integrations |
| 4.6 | `getMaxOrgs()` reads cached entitlement claims; provision path warms cache via `resolve()` |
| 4.7 | Bundled public key: `src/assets/license/envsync-entitlement-public.pem` (private key **not** shipped) |
| 4.10 | Unit tests: `tests/mock/entitlement.test.ts` + fixture keypair under `tests/fixtures/license/` |
| 4.11 | When `ENVSYNC_LICENSE_ENFORCEMENT=true` on self-host, missing entitlement → `ENTITLEMENT_REQUIRED` (not silent unlock) |

### Env vars (new)

| Var | Purpose |
|-----|---------|
| `ENVSYNC_ENTITLEMENT_JWT` | Inline entitlement JWT |
| `ENVSYNC_ENTITLEMENT_JWT_PATH` | Path to JWT file (e.g. `/etc/envsync/license/entitlement.jwt`) |
| `ENVSYNC_ENTITLEMENT_GRACE_SECONDS` | Post-exp grace (default 259200 = 72h) |
| `ENVSYNC_LICENSE_PUBLIC_KEY_PEM` / `_PATH` | Override bundled verify key |
| `ENVSYNC_LICENSE_MODE=entitlement` | File/JWT-first enforcement path |

### Feature catalog

`management`, `oidc`, `saml`, `rotation`, `dynamic_secrets`, `log_forwarding`, `integrations`, `multi_org`

### Behavior matrix

| Mode | Enforcement | Feature gate |
|------|-------------|--------------|
| hosted | any | Always allow (platform billing) |
| selfhost OSS | n/a | Always deny EE features |
| selfhost EE | off (dev) | Edition alone (DX) |
| selfhost EE | on | Verified JWT/cert claims + feature required |
| selfhost EE CLI multi-org | claims | `max_orgs` / `multi_org` only; **web still channel-forbidden** |

## Not in this phase (private / later)

| Item | Notes |
|------|--------|
| 4.2 License-server issue/activate returning entitlement JWT | Private license-server repo |
| 4.8 Deploy-enterprise mount docs polish | Partial via env; full air-gap guide with EE deploy |
| 4.9 Management heartbeat refresh of JWT | Management package split is Phase 5; core validates same state |
| Hosted E2E against live signed entitlement JWT | Existing lease E2E remains; JWT E2E when issuer ships |

## Threat model (D22)

- **Blocked:** flip `ENVSYNC_EDITION`, forge DB `license_state.status=active` without a signature that verifies against the **bundled/public** key, or use env alone under enforcement.
- **Not a goal:** stop a determined fork that patches out `assertFeature` (open-core honesty). Legal, support, and hosted SaaS remain the moat.

## Acceptance

- [x] Enforcement path without valid entitlement → EE feature 403 (`ENTITLEMENT_REQUIRED` / `ENTITLEMENT_FEATURE_MISSING`)  
- [x] JWT signature verify; forged key rejected  
- [x] Self-host `max_orgs=3` claim: CLI channel can provision up to 3; web channel still 403  
- [x] Default / no multi-org claim → max 1  
- [x] Hosted does not depend on customer license file  
- [x] Grace after exp documented + tested  
- [ ] Full hosted license E2E with real entitlement JWT (needs private issuer)  
- [ ] Deploy-enterprise air-gap install runbook smoke  

## Test

```sh
cd packages/envsync-api
bun test tests/mock/entitlement.test.ts
bun test tests/mock/edition-policy.test.ts
```

## Fixture keys

- Public (also bundled for product): `src/assets/license/envsync-entitlement-public.pem`
- Private (**tests only**): `tests/fixtures/license/entitlement-private.pem`  
  Production signing keys live only on the private license-server.
