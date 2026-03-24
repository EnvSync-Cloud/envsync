# Advanced Kubernetes Path

The primary self-hosting path in this repository is the Helm chart under `helm/envsync/`.

This `k8s/` tree is reserved for a later operator-based deployment path using dedicated
infrastructure components such as CloudNativePG, Gateway API, cert-manager, and related
cluster-level add-ons.

Until that path is implemented, use the repo-root Makefile and the Helm chart:

```sh
make kind-create
make helm-deps
make helm-install-kind
```
