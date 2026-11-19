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

# Directory where our manifests live relative to this script
MANIFEST_DIR="$(dirname "$0")/manifests"

echo "Injecting domain into manifests..."

# sed replaces the PLACEHOLDER values in the manifest files
# with the actual domain the operator entered
# -i edits the files in place
sed -i "s/PLACEHOLDER_API_DOMAIN/api.${ROOT_DOMAIN}/g" "$MANIFEST_DIR/13-ingress.yaml"
sed -i "s/PLACEHOLDER_APP_DOMAIN/app.${ROOT_DOMAIN}/g" "$MANIFEST_DIR/13-ingress.yaml"
sed -i "s/PLACEHOLDER_AUTH_DOMAIN/auth.${ROOT_DOMAIN}/g" "$MANIFEST_DIR/13-ingress.yaml"
sed -i "s/PLACEHOLDER_S3_DOMAIN/s3.${ROOT_DOMAIN}/g"   "$MANIFEST_DIR/13-ingress.yaml"

# Also inject the auth domain into zitadel so it knows its external URL
sed -i "s/PLACEHOLDER_AUTH_DOMAIN/auth.${ROOT_DOMAIN}/g" "$MANIFEST_DIR/10-zitadel.yaml"

# Also inject the api domain into envsync-web so it knows where the API is
sed -i "s/PLACEHOLDER_API_DOMAIN/api.${ROOT_DOMAIN}/g" "$MANIFEST_DIR/12-envsync-web.yaml"

echo "Applying manifests in dependency order..."

# Apply each manifest in numbered order
# Each number prefix ensures correct dependency sequencing
for manifest in "$MANIFEST_DIR"/*.yaml; do
  echo "  Applying $(basename "$manifest")..."
  kubectl apply -f "$manifest"
done

echo "Waiting for core pods to be ready..."

# Wait for postgres first since everything depends on it
kubectl wait --namespace envsync \
  --for=condition=ready pod \
  --selector=app=postgres \
  --timeout=120s

# Wait for envsync-api last since it depends on all other services
kubectl wait --namespace envsync \
  --for=condition=ready pod \
  --selector=app=envsync-api \
  --timeout=180s

echo "Pods are ready."

# Run EnvSync's own initialization sequence
# This creates Zitadel OIDC apps and writes client IDs to .env
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