#!/bin/bash
# upgrade.sh - Upgrades EnvSync services to a new image version on K3S
# Usage: sudo bash upgrade.sh <new-image-tag>
# Example: sudo bash upgrade.sh v0.4.2
set -euo pipefail

# Require exactly one argument — the new image tag to deploy
if [[ $# -ne 1 ]]; then
  echo "Usage: bash upgrade.sh <new-image-tag>"
  echo "Example: bash upgrade.sh v0.4.2"
  exit 1
fi

NEW_TAG="$1"
NAMESPACE="envsync"

echo "============================================"
echo " EnvSync Upgrade: ${NEW_TAG}"
echo "============================================" 

# Always back up before upgrading — if anything goes wrong we can restore
echo "Running pre-upgrade backup..."
bash "$(dirname "$0")/backup.sh"
echo "Backup complete. Proceeding with upgrade..." 

# Update each deployment to the new image tag
# kubectl set image triggers a rolling update — pods are replaced one by one
# so the service stays available during the upgrade
echo "Updating envsync-api..."
kubectl set image deployment/envsync-api \
  envsync-api=ghcr.io/envsync-cloud/envsync-api:${NEW_TAG} \
  -n "$NAMESPACE"

echo "Updating envsync-web..."
kubectl set image deployment/envsync-web \
  envsync-web=ghcr.io/envsync-cloud/envsync-web:${NEW_TAG} \
  -n "$NAMESPACE" 

echo "Watching rollout status..."

# kubectl rollout status blocks until the rollout completes or fails
# If it fails we immediately roll back to the previous working version
if ! kubectl rollout status deployment/envsync-api -n "$NAMESPACE" --timeout=120s; then
  echo "Rollout failed — rolling back envsync-api..."
  kubectl rollout undo deployment/envsync-api -n "$NAMESPACE"
  exit 1
fi

if ! kubectl rollout status deployment/envsync-web -n "$NAMESPACE" --timeout=120s; then
  echo "Rollout failed — rolling back envsync-web..."
  kubectl rollout undo deployment/envsync-web -n "$NAMESPACE"
  exit 1
fi

echo ""
echo "============================================"
echo " Upgrade to ${NEW_TAG} complete!"
echo "============================================" 