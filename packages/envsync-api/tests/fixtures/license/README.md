# License test fixtures

`entitlement-private.pem` and `entitlement-public.pem` are a test-only Ed25519
pair. They do not match `src/assets/license/envsync-entitlement-public.pem`.
Production verification does not trust either file.

`retired-entitlement.jwt` was signed by the previous fixture private key, the
one that matched that retired public key. Verification must reject it. The
private key for that token is not in this directory.
