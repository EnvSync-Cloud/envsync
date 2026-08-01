# License-server deploy (private issuer)

**Scope:** Private `@envsync-cloud/license-server` (Ed25519 entitlement JWT issuer).  
**Public monorepo:** package is **gitignored** (`packages/license-server/`). Product verify path ships in `envsync-api`.  
**Related:** [LICENSE-RUNBOOK.md](./LICENSE-RUNBOOK.md), [plans/phase-h4/PRIVATE_LICENSE_SERVER_PATCH.md](./plans/phase-h4/PRIVATE_LICENSE_SERVER_PATCH.md)

---

## 1. What this service does

| Endpoint family | Purpose |
|-----------------|---------|
| Activate / verify lease | Online self-host EE; returns `signed_lease` as **EdDSA JWT** |
| Certificate issue | Offline-ish X.509 enterprise certs (optional) |
| License generate (admin) | Issue keys with `features` + `max_orgs` |

Claims on `signed_lease` (H4):

- `ver: 1`
- `sub` / `install_fingerprint`
- `edition: "enterprise"`
- `features: string[]`
- `max_orgs: number`
- `iss: envsync-license-server`
- alg: **EdDSA** (Ed25519)

API verifies with bundled `envsync-entitlement-public.pem` (private key **never** in API images).

---

## 2. Required secrets (production)

| Secret | Description |
|--------|-------------|
| `LICENSE_ENTITLEMENT_PRIVATE_KEY_PEM` or `_FILE` | Ed25519 PKCS8 PEM — **must match** public key shipped in API |
| `LICENSE_SERVER_ACCESS_KEY` | Admin/generate API access |
| `LIBSQL_SERVER` / `LIBSQL_AUTHTOKEN` | License DB |
| `LICENSE_CA_ROOT_CERT_PEM` / `LICENSE_CA_ROOT_KEY_PEM` | Only if issuing X.509 certs |

Optional:

| Var | Default / note |
|-----|----------------|
| `PORT` | `4010` |
| `LICENSE_SERVER_LEASE_TTL_SECONDS` | `300` |
| `LICENSE_SERVER_SIGNING_SECRET` | **Deprecated** HS256 fallback if Ed25519 key missing — do not use in prod |

---

## 3. Deploy steps

### A. Private repository / artifact

1. Ensure private license-server repo (or force-added local `packages/license-server`) includes H4 EdDSA issuer ([patch notes](./plans/phase-h4/PRIVATE_LICENSE_SERVER_PATCH.md)).
2. Build container from `packages/license-server/Dockerfile` (if present) or:

```sh
cd packages/license-server   # private tree
bun install --production
bun run start
```

3. Mount private key via secret volume or env; never bake into public images.

### B. Platform (example)

```text
1. Create secret LICENSE_ENTITLEMENT_PRIVATE_KEY_PEM (Ed25519 PKCS8)
2. Deploy service behind mTLS or network policy (only Hosted ops + customer activate egress)
3. Health: GET /health → entitlement_issuer_ready: true
4. Smoke: activate with dev/staging license key + install fingerprint
5. Confirm API LicenseStateService stores lease and assertFeature works under enforcement
```

### C. Key rotation

1. Generate new Ed25519 pair.
2. Ship **new public** key with API release (or dual-verify window if implemented).
3. Deploy license-server with new private key.
4. Re-activate installs (or re-issue JWTs) before old key decommission.

Dev fixture pair (monorepo only):

- Public: `packages/envsync-api/src/assets/license/envsync-entitlement-public.pem`
- Private: `packages/envsync-api/tests/fixtures/license/entitlement-private.pem`

**Production keys must not be the fixture pair.**

---

## 4. Hosted vs self-host

| Topology | Needs license-server? |
|----------|------------------------|
| **Hosted** | No customer entitlement path; platform billing. Issuer optional for internal tooling only. |
| **Self-host EE online** | Yes — activate/verify against `ENVSYNC_LICENSE_SERVER_URL` |
| **Self-host EE air-gap** | No online server; ship offline JWT/cert (still signed by this issuer offline) |

---

## 5. Verification

### Private package (when present on disk)

```sh
cd packages/license-server && bun test
# expects entitlement-sign tests + EdDSA jwtVerify against API public PEM
```

### Public monorepo (always)

```sh
cd packages/envsync-api && bun test tests/mock/entitlement-lease.test.ts
bun run check:boundaries
```

### Post-deploy smoke

```sh
curl -sS "$LICENSE_URL/health" | jq .
# activate against staging key → signed_lease is three JWT segments
# jwt header alg == EdDSA
```

---

## 6. Acceptance

- [x] Issuer code path documented (H4 patch + this deploy runbook)
- [x] Public verify tests in monorepo
- [ ] Production license-server deployed with **non-fixture** Ed25519 key (ops)
- [ ] Staging activate → self-host EE feature gate green under `ENVSYNC_LICENSE_ENFORCEMENT=true`

Ops owns the last two checkboxes; engineering ships issuer + docs in private tree / monorepo fixtures.
