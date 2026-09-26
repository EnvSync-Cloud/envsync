# miniKMS sidecar files

`session-signing-key.dev.pem` is a **local/CI-only** P-256 PKCS#8 key, and
`root-ca-cert.dev.pem` / `root-ca-key.dev.pem` are a **local/CI-only** P-384
root CA, so `ghcr.io/envsync-cloud/minikms:sha-7640ffc+` can boot. Production
Swarm generates its own material under `/opt/envsync/deploy/`. Do not reuse the
committed files on a public host.

## P-256 session signing key

miniKMS will not bind `:50051` unless `MINIKMS_SESSION_SIGNING_KEY_FILE` is a
**P-256** EC private key in PKCS#8 or SEC1 PEM. RSA / P-384 / missing file =
process exit. Local compose mounts `session-signing-key.dev.pem`. Swarm writes
`/opt/envsync/deploy/minikms-session-signing-key.pem` (deploy CLI generates
P-256 if the file is empty).

Check an existing key:

```sh
openssl pkey -in /opt/envsync/deploy/minikms-session-signing-key.pem -noout -text | grep "ASN1 OID"
# want: prime256v1
```

Replace only if that is not P-256 (sessions issued with the old key become
invalid):

```sh
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 \
  -out /opt/envsync/deploy/minikms-session-signing-key.pem
chmod 644 /opt/envsync/deploy/minikms-session-signing-key.pem
```

## Upgrade to `sha-7640ffc`

Image pin is `ghcr.io/envsync-cloud/minikms:sha-7640ffc` (compose + Swarm).
That build adds env CAs, SPIFFE SANs, and offline-root CSR. Deploy CLI
`upgrade` already:

1. Pulls the pinned image
2. Runs miniKMS SQL `001`–`007` (`006_env_ca`, `007_pending_org_ca`)
3. Rewrites the session-key file if missing (P-256)
4. Leaves an existing P-384 root CA in place (`pathlen:1`)

Operator checklist:

- Session key is P-256 (above).
- After upgrade, `docker service logs envsync_minikms` shows gRPC on `:50051`,
  not "session signing key must use the P-256 curve".
- Org CAs created **before HA key wrapping** still have no
  `encrypted_private_key`. Member certs fail with
  `organization CA private key is not available in durable storage`.
  Retire that org CA in the dashboard and re-init so miniKMS stores the key.
- Do not copy `*.dev.pem` onto a public host.
