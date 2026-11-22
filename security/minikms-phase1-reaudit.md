# miniKMS Phase 1 re-audit

Audited revision: `e8722a6` (`Merge pull request #21`) on `EnvSync-Cloud/minikms` `main`.

Source audit file `SECURITY-AUDIT.md` is not in that repository at `4280c5e` or at `e8722a6`. Finding numbers below are the ones named on DEV-104 and the Phase 1 child tickets. The check is a control review of `e8722a6`, not a new penetration test.

No customer or regulator notice was sent.

## Required findings

| Finding | Class | Result at `e8722a6` | Evidence |
| --- | --- | --- | --- |
| 1 | Unauthenticated `IssueMemberCert` | Not reproduced | `authorizePKI` rejects a missing principal. `TestPKIAdapter_IssueMemberCert_Unauthenticated`. |
| 2 | Managed-member `KeyPem` returned to the caller | Not reproduced | `IssueMemberCert` sets `KeyPem` to an empty string. DEV-98, `e618159`. |
| 3 | KMS encrypt/decrypt not bound to the caller tenant | Not reproduced | `TestKMSService_MissingPrincipalIsUnauthenticated`, `TestKMSService_CrossTenantDenied`, `TestKMSService_AuditActorEqualsSessionPrincipal`. DEV-139, `8e2702a`. |
| 4 | `CreateSession` trusts a self-signed cert with a known serial | Not reproduced | Registry PEM compare and org-CA chain check run before identity is read. `TestCreateSessionByCert_SelfSignedKnownSerial`, `TestCreateSessionByCert_PEMMismatch`, `TestCreateSessionByCert_IdentityFromRegistry`, `TestCreateSessionByCert_ChainedRegistryCertSucceeds`. DEV-100, `ba41f16`. |
| 5 | Unauthenticated, unscoped session list and revoke | Not reproduced | `ListSessions` and `RevokeMemberSessions` require a principal and the caller org. A non-admin cannot manage another member. DEV-101, `751a268`. |
| 6 | `GetAuditLogs` trusts a caller-supplied org | Not reproduced | Audit reads use the principal tenant. DEV-101, `751a268`. |
| 9 | Original text is not in the repository | Transport class closed | `SECURITY-AUDIT.md` is absent at `4280c5e`, so finding 9's wording was not recovered. The transport controls from that cut are on `main`: startup without TLS fails unless `MINIKMS_ALLOW_INSECURE=true`, and reflection is off unless `MINIKMS_REFLECTION_ENABLED=true`. DEV-140, `994d5d4`. |
| 10 | `orgID[:8]` panics on a short org id | Not reproduced | `pendingOrgCASerial` checks length first. `TestCreateOrgCACSR_ShortOrgIDDoesNotPanic`. DEV-103, `66084aa`. |
| 12 | Rate limiter constructed and discarded | Not reproduced | `cmd/minikms/main.go` passes the Redis limiter into the interceptor chain. `TestRateLimitReturnsResourceExhausted`. DEV-138, `b0fe4fb`. |

Recovery interceptors are installed. An unexpected handler panic becomes `codes.Internal` and the process stays up.

## Same class, already tracked

These are not reproductions of the nine findings. They are recorded so they are not left untracked.

- `CreateOrgCA` is still unauthenticated. It bootstraps the first organization and returns a one-time admin session. `IssueMemberCert`, `RevokeCert`, and `InstallOrgCA` are not in that allowlist. Recorded on DEV-98.
- `IssueLeafCert` still returns `KeyPem` to an authenticated caller. That is a client-held leaf key, not the managed-member path. The managed-member response does not include `KeyPem`.

## Not in this re-audit

Findings 7, 8, 11, and 13–20 are Phase 2 or later. They were not re-scored here.
