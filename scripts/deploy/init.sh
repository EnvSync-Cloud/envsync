#!/bin/bash
# init.sh - Initializes a fresh Linux server with K3S and deploys EnvSync
# Platform agnostic - works on any Ubuntu/Debian server
# Usage: sudo bash init.sh
set -euo pipefail 

# Ask the operator for the root domain at runtime
# All subdomains will be generated from this e.g. api.envsync.cloud
echo "============================================"
echo "       EnvSync K3S Deployment Setup        "
echo "============================================"
read -rp "Enter your root domain (e.g. envsync.cloud): " ROOT_DOMAIN

# Confirm before proceeding
echo ""
echo "Deploying EnvSync to the following subdomains:"
echo "  API:     api.${ROOT_DOMAIN}"
echo "  Auth:    auth.${ROOT_DOMAIN}"
echo "  S3:      s3.${ROOT_DOMAIN}"
echo "  Web app: app.${ROOT_DOMAIN}"
echo ""
read -rp "Continue? (y/n): " CONFIRM
if [[ "$CONFIRM" != "y" ]]; then
  echo "Aborted."
  exit 0
fi 

echo "Installing K3S..."

# K3S is a lightweight single-node Kubernetes distribution
# --write-kubeconfig-mode 644 makes the kubeconfig readable without sudo
curl -sfL https://get.k3s.io | sh -s - \
  --write-kubeconfig-mode 644 

echo "Waiting for K3S to be ready..."

# Loop until the node reports Ready status
# This usually takes 20-30 seconds on first boot
until kubectl get node | grep -q "Ready"; do
  echo "  ...waiting for node"
  sleep 5
done

echo "K3S is ready." 

# Create a temporary directory to hold all Kubernetes YAML manifests
MANIFEST_DIR="/tmp/envsync-manifests"
mkdir -p "$MANIFEST_DIR" 

echo "Generating Kubernetes manifests..."

# Namespace keeps all EnvSync resources grouped together in K3S
cat > "$MANIFEST_DIR/namespace.yaml" << EOF
apiVersion: v1
kind: Namespace
metadata:
  name: envsync
EOF 

# Generate one IngressRoute per subdomain using ROOT_DOMAIN variable
# Traefik is built into K3S so no separate ingress controller needed
cat > "$MANIFEST_DIR/ingress.yaml" << EOF
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: envsync-api
  namespace: envsync
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(\`api.${ROOT_DOMAIN}\`)
      kind: Rule
      services:
        - name: envsync-api
          port: 3000
---
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: envsync-web
  namespace: envsync
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(\`app.${ROOT_DOMAIN}\`)
      kind: Rule
      services:
        - name: envsync-web
          port: 5173
---
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: envsync-auth
  namespace: envsync
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(\`auth.${ROOT_DOMAIN}\`)
      kind: Rule
      services:
        - name: zitadel
          port: 8080
---
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: envsync-s3
  namespace: envsync
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(\`s3.${ROOT_DOMAIN}\`)
      kind: Rule
      services:
        - name: rustfs
          port: 9000
EOF 

echo "Applying manifests..."

# Apply namespace first so it exists before other resources try to use it
kubectl apply -f "$MANIFEST_DIR/namespace.yaml"

# Apply ingress routes so Traefik knows where to route traffic
kubectl apply -f "$MANIFEST_DIR/ingress.yaml"

echo "Manifests applied." 

echo "Waiting for pods to be ready..."

# Wait up to 120 seconds for all deployments in the envsync namespace
kubectl wait --namespace envsync \
  --for=condition=ready pod \
  --selector=app=envsync-api \
  --timeout=120s

echo "Pods are ready."

# Run EnvSync's own initialization sequence
# This creates the Zitadel OIDC apps and writes client IDs to .env
echo "Running EnvSync init..."
bun run cli init

echo ""
echo "============================================"
echo " EnvSync deployed successfully!"
echo "============================================"
echo "  API:     https://api.${ROOT_DOMAIN}"
echo "  Auth:    https://auth.${ROOT_DOMAIN}"
echo "  S3:      https://s3.${ROOT_DOMAIN}"
echo "  Web app: https://app.${ROOT_DOMAIN}"
echo "============================================" 

