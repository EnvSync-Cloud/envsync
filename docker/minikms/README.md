# miniKMS sidecar files

`session-signing-key.dev.pem` is a **local/CI-only** P-256 PKCS#8 key, and
`root-ca-cert.dev.pem` / `root-ca-key.dev.pem` are a **local/CI-only** P-384
root CA, so `ghcr.io/envsync-cloud/minikms:sha-7640ffc+` can boot. Production
Swarm generates its own material under `/opt/envsync/deploy/`. Do not reuse the
committed files on a public host.
