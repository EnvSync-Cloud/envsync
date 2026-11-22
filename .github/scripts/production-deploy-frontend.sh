#!/usr/bin/env bash
# Dispatch the hosted frontend workflow for this tag and wait for it.
set -euo pipefail

if [ -z "${RELEASE_TAG:-}" ]; then
	echo "Missing required environment variable: RELEASE_TAG" >&2
	exit 1
fi

before=$(date -u -d '2 minutes ago' +%Y-%m-%dT%H:%M:%SZ)
gh workflow run deploy-fe.yaml --ref "$RELEASE_TAG"

run_id=""
for _ in $(seq 1 30); do
	run_id=$(
		gh run list --workflow deploy-fe.yaml --limit 15 \
			--json databaseId,event,headBranch,createdAt \
			--jq "[.[] | select(.event==\"workflow_dispatch\" and .headBranch==\"${RELEASE_TAG}\" and .createdAt >= \"${before}\")] | .[0].databaseId"
	)
	if [ -n "$run_id" ] && [ "$run_id" != "null" ]; then
		break
	fi
	run_id=""
	sleep 5
done

if [ -z "$run_id" ]; then
	echo "Hosted frontend deploy did not start for ${RELEASE_TAG}" >&2
	exit 1
fi

echo "Watching hosted frontend deploy run ${run_id}"
gh run watch "$run_id" --exit-status
