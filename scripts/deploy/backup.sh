#!/bin/bash
# backup.sh - PostgreSQL backup script for EnvSync K3S deployment 
# Dumps the database to local disk and prunes backups older than 7 days 
set -euo pipefail 

# Timestamp used for the backup folder name e.g. 2026-03-23_11-55-00
DATE=$(date +%Y-%m-%d_%H-%M-%S) 

# Full path where this backup will be stored  
BACKUP_DIR="/var/backups/envsync/${DATE}"  

# Kubernetes namespace where EnvSync pods are running
NAMESPACE="envsync" 

# Dynamically find the postgres pod name — never hardcode pod names,
# Kubernetes regenerates them on every restart
POSTGRES_POD=$(kubectl get pod -n "$NAMESPACE" \
  -l app=postgres \
  --no-headers \
  -o custom-columns=":metadata.name") 

 echo "Starting EnvSync backup: ${DATE}"

# -p creates parent directories if they don't exist
# and won't error if the folder already exists
mkdir -p "${BACKUP_DIR}"  

echo "Dumping PostgreSQL..."

# kubectl exec runs a command inside the running postgres pod
# The -- separates kubectl flags from the command being run inside the pod
# Output is redirected into a .sql file in our backup directory
kubectl exec -n "$NAMESPACE" "$POSTGRES_POD" -- \
  pg_dump -U postgres envsync \
  > "${BACKUP_DIR}/envsync_db.sql" 

echo "Pruning backups older than 7 days..."

# find options explained:
# -maxdepth 1  only look one level deep, don't recurse into backup folders
# -type d      only match directories, not files
# -mtime +7    only match directories older than 7 days
# -exec rm -rf {} +  delete each match
find /var/backups/envsync -maxdepth 1 -type d -mtime +7 -exec rm -rf {} +

echo "Backup complete: ${BACKUP_DIR}"

# Show what was saved with human-readable file sizes
ls -lh "${BACKUP_DIR}" 
