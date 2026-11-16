# miniKMS local fixtures

Files in this directory named `*.dev.pem` are **development and test fixtures**.
The `.dev.pem` suffix is the filename convention for that: local Compose
(`docker-compose.yaml`) and CI may mount them. Production Compose
(`docker-compose.prod.yaml`) does not. Production requires operator-supplied
paths (`MINIKMS_*_PATH` in `.env.prod.example`) and exits when those paths are
missing.

`session-signing-key.dev.pem` is a local/CI-only P-256 PKCS#8 key, and
`root-ca-cert.dev.pem` / `root-ca-key.dev.pem` are a local/CI-only P-384 root
CA, so `ghcr.io/envsync-cloud/minikms:sha-4280c5e+` can boot in development.

`grpc-ca-cert.dev.pem` plus `grpc-server-*.dev.pem` and `grpc-client-*.dev.pem`
are a local/CI-only control-plane CA for mTLS between `envsync-api` and
miniKMS. The deploy CLI generates its own material under `/opt/envsync/deploy/`
when those files are missing. Do not reuse the committed `*.dev.pem` files on
a production host.
