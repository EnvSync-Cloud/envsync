# Private license-server patch (H4)

`packages/license-server/` is **gitignored** in this monorepo. Apply the following
to the **private** license-server repository (or force-add locally if your process allows).

## Required env

- `LICENSE_ENTITLEMENT_PRIVATE_KEY_PEM` or `LICENSE_ENTITLEMENT_PRIVATE_KEY_FILE` — Ed25519 PKCS8 PEM
- Public counterpart already ships in `envsync-api` as `envsync-entitlement-public.pem`

## Code changes (summary)

1. Load Ed25519 private key via `jose` `importPKCS8(pem, "EdDSA")`.
2. Replace HS256-only `signLease` with EdDSA JWT claims:
   - `ver: 1`
   - `install_fingerprint` (also JWT `sub`)
   - `edition: "enterprise"`
   - `features: string[]` (default management/oidc/saml/rotation/dynamic_secrets/log_forwarding/integrations)
   - `max_orgs: number` (default 1)
   - `iss: envsync-license-server`
3. Response: include `signed_lease` + optional `entitlement_alg: "EdDSA"`.
4. License generate: optional `features`, `max_orgs` stored on license record.
5. Health: `entitlement_issuer_ready: boolean`.

A full working copy of the monorepo private scaffold (if present on disk) includes these
changes under `packages/license-server/src/index.ts` after H4 development.

## Verify against API

```sh
# From monorepo (public):
cd packages/envsync-api && bun test tests/mock/entitlement-lease.test.ts

# Private license-server tests should jwtVerify with the public PEM shipped in API assets.
```

## Consumer (envsync-api)

`LicenseStateService.applyLicenseServerResponse` already calls `EntitlementService.verifyJwt`
when `signed_lease` looks like a JWT (Phase 4). No additional API change required beyond
optional `entitlement_alg` on the response type.
