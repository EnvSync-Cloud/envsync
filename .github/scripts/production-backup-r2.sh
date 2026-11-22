#!/usr/bin/env bash
# Take an encrypted production backup over SSH and upload it to Cloudflare R2.
# The identity file is uploaded next to the archive. This script never prints key material.
set -euo pipefail

require() {
	local name="$1"
	if [ -z "${!name:-}" ]; then
		echo "Missing required environment variable: ${name}" >&2
		exit 1
	fi
}

require PROD_SSH_HOST
require PROD_SSH_USER
require PROD_SSH_KEY_FILE
require CLOUDFLARE_R2_ACCOUNT_ID
require CLOUDFLARE_R2_ACCESS_KEY_ID
require CLOUDFLARE_R2_SECRET_ACCESS_KEY
require CLOUDFLARE_R2_BUCKET
require RELEASE_TAG

prefix="${CLOUDFLARE_R2_PREFIX:-envsync/production}"
prefix="${prefix#/}"
prefix="${prefix%/}"

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
remote_script="${script_dir}/production-backup-remote.sh"
if [ ! -f "$remote_script" ]; then
	echo "Missing ${remote_script}" >&2
	exit 1
fi
if [ ! -f "$PROD_SSH_KEY_FILE" ]; then
	echo "SSH key file does not exist" >&2
	exit 1
fi
chmod 600 "$PROD_SSH_KEY_FILE"

{
	python3 - "$prefix" <<'PY'
import os, shlex, sys
prefix = sys.argv[1]
names = {
    "AWS_ACCESS_KEY_ID": os.environ["CLOUDFLARE_R2_ACCESS_KEY_ID"],
    "AWS_SECRET_ACCESS_KEY": os.environ["CLOUDFLARE_R2_SECRET_ACCESS_KEY"],
    "R2_ACCOUNT_ID": os.environ["CLOUDFLARE_R2_ACCOUNT_ID"],
    "R2_BUCKET": os.environ["CLOUDFLARE_R2_BUCKET"],
    "R2_PREFIX": prefix,
    "RELEASE_TAG": os.environ["RELEASE_TAG"],
}
for name, value in names.items():
    print(f"export {name}={shlex.quote(value)}")
PY
	cat "$remote_script"
} | ssh \
	-o BatchMode=yes \
	-o StrictHostKeyChecking=accept-new \
	-o ServerAliveInterval=30 \
	-o ServerAliveCountMax=40 \
	-i "$PROD_SSH_KEY_FILE" \
	"${PROD_SSH_USER}@${PROD_SSH_HOST}" \
	"sudo -n bash -s"
