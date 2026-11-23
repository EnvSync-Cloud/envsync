#!/usr/bin/env bash
# Install the release's enterprise deploy CLI on the production host and upgrade.
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
require RELEASE_TAG

version="${RELEASE_TAG#v}"
if [ -z "$version" ] || [ "$version" = "$RELEASE_TAG" ]; then
	echo "RELEASE_TAG must look like v1.2.3" >&2
	exit 1
fi

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
remote_script="${script_dir}/production-upgrade-remote.sh"
if [ ! -f "$remote_script" ]; then
	echo "Missing ${remote_script}" >&2
	exit 1
fi
chmod 600 "$PROD_SSH_KEY_FILE"

{
	python3 - "$version" <<'PY'
import shlex, sys
print(f"export RELEASE_VERSION={shlex.quote(sys.argv[1])}")
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
