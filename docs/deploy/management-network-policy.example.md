# Example: keep Management API private (Phase 7.4)

Self-host **Enterprise** runs a separate management API process. It should not be
reachable from the public internet—only from the dashboard shell (same Swarm
network / mesh) and operator hosts.

## Docker Swarm (illustrative)

```yaml
# Snippet — attach management-api to an internal overlay only.
services:
  envsync-management-api:
    networks:
      - envsync_internal
    # Do not publish host ports for management API in production.
    # ports: []   # omit public publish
    deploy:
      labels:
        # Prefer internal Traefik/entrypoint only, or no public router.
        - "traefik.enable=false"

networks:
  envsync_internal:
    driver: overlay
    internal: true
```

## Kubernetes NetworkPolicy (illustrative)

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: envsync-management-api-ingress
  namespace: envsync
spec:
  podSelector:
    matchLabels:
      app: envsync-management-api
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: envsync-web
        - podSelector:
            matchLabels:
              app: envsync-api
      ports:
        - protocol: TCP
          port: 4001
```

## Product rules

- Public edge: dashboard + core API only (as required).
- Management API: private network; dashboard calls it with session cookies / same-site config.
- License volume (`/etc/envsync/license`) mounts only on API/management tasks—not on public web static.

Adapt hostnames and selectors to your `envsync-deploy-enterprise` stack.
