# miniKMS sidecar files

`session-signing-key.dev.pem` is a **local/CI-only** P-256 PKCS#8 key, and
`root-ca-cert.dev.pem` / `root-ca-key.dev.pem` are a **local/CI-only** P-384
root CA, so miniKMS can boot.

`grpc-ca-cert.dev.pem` plus `grpc-server-*.dev.pem` and `grpc-client-*.dev.pem`
are a **local/CI-only** control-plane CA for mTLS between `envsync-api` and
miniKMS. Swarm generates its own material under `/opt/envsync/deploy/`. Do not
reuse the committed files on a public host.
