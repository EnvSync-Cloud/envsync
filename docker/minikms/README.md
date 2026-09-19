# miniKMS sidecar files

`session-signing-key.dev.pem` is a **local/CI-only** P-256 PKCS#8 key so
`ghcr.io/envsync-cloud/minikms:sha-e4fdb24+` can boot. Production Swarm
generates its own key into `/opt/envsync/deploy/minikms-session-signing-key.pem`.
Do not reuse the committed file on a public host.
