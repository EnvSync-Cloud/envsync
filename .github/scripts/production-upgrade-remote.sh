#!/usr/bin/env bash
# Runs on the production host as root. Caller exports RELEASE_VERSION.
set -euo pipefail

if [ -z "${RELEASE_VERSION:-}" ]; then
	echo "Missing required environment variable: RELEASE_VERSION" >&2
	exit 1
fi

workdir=$(mktemp -d /tmp/envsync-deploy-install.XXXXXX)
cleanup() { rm -rf "$workdir"; }
trap cleanup EXIT
cd "$workdir"

ok=0
for attempt in 1 2 3 4 5 6; do
	if npm pack "@envsync-cloud/deploy-enterprise@${RELEASE_VERSION}" --registry=https://npm.pkg.github.com; then
		ok=1
		break
	fi
	echo "deploy-enterprise ${RELEASE_VERSION} is not on GitHub Packages yet (attempt ${attempt})" >&2
	sleep 20
done
if [ "$ok" -ne 1 ]; then
	echo "Could not download @envsync-cloud/deploy-enterprise@${RELEASE_VERSION}" >&2
	exit 1
fi

npm install -g ./*.tgz
installed=$(node -p "require('/usr/lib/node_modules/@envsync-cloud/deploy-enterprise/package.json').version")
if [ "$installed" != "$RELEASE_VERSION" ]; then
	echo "Installed deploy CLI ${installed}, expected ${RELEASE_VERSION}" >&2
	exit 1
fi

envsync-deploy-enterprise upgrade "$RELEASE_VERSION"
