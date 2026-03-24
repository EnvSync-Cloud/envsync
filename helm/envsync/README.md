# EnvSync Helm Chart

This chart deploys the core EnvSync control-plane services for self-hosted Kubernetes:

- `envsync-api`
- `envsync-init` bootstrap job
- `envsync-migrate` upgrade hook
- PostgreSQL
- Redis
- Zitadel
- OpenFGA
- MiniKMS
- RustFS

## Local Kind Flow

From the repository root:

```sh
make kind-create
make helm-deps
make helm-install-kind
kubectl port-forward -n envsync svc/envsync-api 4000:4000
curl http://127.0.0.1:4000/health
```

The Kind flow writes generated bootstrap secrets into `.tmp/values-kind.generated.yaml`
so the chart can come up without editing tracked files.

## Notes

- The chart is the primary self-hosting path in this repo.
- The advanced operator-based `k8s/` path is intentionally deferred until the Helm path is stable.
- Ingress is disabled in `values-kind.yaml`; use `port-forward` for local validation.
