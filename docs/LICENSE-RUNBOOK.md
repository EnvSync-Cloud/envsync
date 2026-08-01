# License runbook (Hosted + Self-host EE)

**H4** — entitlement JWT issuance + ops. See also [SELFHOSTING.md](../SELFHOSTING.md) and program plan D20–D22.

## Hosted (EnvSync Cloud)

| Topic | Policy |
|-------|--------|
| Authority | **Platform billing / ops** — not customer entitlement files |
| `ENVSYNC_DEPLOYMENT_MODE` | `hosted` |
| `ENVSYNC_LICENSE_ENFORCEMENT` | Typically `false`; feature gates **bypass** customer JWT on hosted (`assertFeature`) |
| Customer JWT / cert mount | **Not required** |
| Multi-org | SaaS policy (unlimited via `getMaxOrgs()` = null) |

Do **not** require `/etc/envsync/license` on Hosted API pods for product features.

## Self-host Enterprise

### Modes

| Mode | Env | Authority |
|------|-----|-----------|
| **entitlement** (preferred online) | `ENVSYNC_LICENSE_MODE=entitlement` or `ENVSYNC_ENTITLEMENT_JWT` / `_PATH` | Ed25519 JWT verify (public key in API binary) |
| **certificate** | `ENVSYNC_LICENSE_MODE=certificate` + bundle/cert paths | X.509 + metadata OID; grants default feature set |
| **lease** | `ENVSYNC_LICENSE_MODE=lease` + license server URL/key | Online activate/verify; `signed_lease` should be **EdDSA entitlement JWT** (H4) |

### Recommended online flow

1. Deploy license-server (private) with:
   - `LICENSE_ENTITLEMENT_PRIVATE_KEY_PEM` or `_FILE` (Ed25519 PKCS8) matching API public key
   - libSQL + access key
2. Customer install:
   ```bash
   ENVSYNC_DEPLOYMENT_MODE=selfhosted
   ENVSYNC_EDITION=enterprise
   ENVSYNC_LICENSE_ENFORCEMENT=true
   ENVSYNC_LICENSE_MODE=lease   # or entitlement after writing JWT file
   ENVSYNC_LICENSE_SERVER_URL=https://license.example.com
   ENVSYNC_LICENSE_KEY=...
   ENVSYNC_INSTALL_FINGERPRINT=...
   ```
3. Activate → license-server returns `signed_lease` (EdDSA JWT with `features`, `max_orgs`, `iss=envsync-license-server`).
4. API `LicenseStateService` stores lease and **verifies JWT** into `EntitlementService` cache.
5. Feature gates require claims; multi-org CLI uses `max_orgs` claim.

### Offline / air-gap

1. EnvSync issues signed entitlement JWT (or cert bundle) bound to install fingerprint.
2. Install JWT:
   ```bash
   ENVSYNC_LICENSE_MODE=entitlement
   ENVSYNC_ENTITLEMENT_JWT_PATH=/etc/envsync/license/entitlement.jwt
   # optional override verify key:
   # ENVSYNC_LICENSE_PUBLIC_KEY_PATH=/etc/envsync/license/entitlement-public.pem
   ```
3. Or certificate mode with bundle under `/etc/envsync/license/`.

### Public key

API ships `packages/envsync-api/src/assets/license/envsync-entitlement-public.pem`.  
**Private key never ships in customer/API images** — only on license-server.

Dev monorepo: private fixture at  
`packages/envsync-api/tests/fixtures/license/entitlement-private.pem`  
(matches bundled public key). License-server auto-loads this path in local monorepo if env not set.

## Threat model (D22)

- Blocks script-kiddie env flip / forged DB `license_state` without valid signature when enforcement is on.
- Does **not** stop a determined fork that patches out `assertFeature`.
