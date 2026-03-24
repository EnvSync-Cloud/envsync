# EnvSync Self-Hosting Bring-Up Report

## Goal

Get EnvSync running locally in a self-hosting-oriented setup without changing application source code.

## What Was Added

### Deployment scaffolding

- Added a Helm-first deployment scaffold under `helm/envsync/`.
- Added a repo-root `Makefile` to wrap Kind and Helm workflows.
- Added `kind-config.yaml` for local cluster creation.
- Added a minimal `k8s/README.md` and replaced the old `k8s/Makefile` with a stub so the repo no longer pretends the advanced operator-based path is already implemented.

### Compose/runtime improvements

- Updated `docker-compose.prod.yaml` so local self-hosting can actually bootstrap and run.
- Added `.tmp` and `helm/envsync/charts` to `.gitignore` to keep local tool installs and vendored chart artifacts out of git.

## What Was Verified Live

The following stack was brought up successfully via `docker compose -f docker-compose.prod.yaml`:

- `envsync_api`
- `postgres`
- `redis`
- `rustfs`
- `zitadel_db`
- `zitadel`
- `openfga_db`
- `openfga_migrate`
- `openfga`
- `minikms_db`
- `minikms`

Bootstrap was run successfully with `envsync_init`, and the generated values were written back into the local `.env`.

Verified working endpoints:

- `http://localhost:4000/health`
- `http://localhost:4000/version`
- `http://localhost:4000/api/access/web`
- `http://auth.127.0.0.1.sslip.io:8080`

## Fixes Applied

### 1. OpenFGA bootstrap failure from unsafe password characters

Problem:

- `openfga_migrate` builds a Postgres URI directly from `OPENFGA_DB_PASSWORD`.
- Random passwords containing `/` or `+` broke URI parsing.

Fix:

- Regenerated local compose secrets with URL-safe values.
- Recreated the fresh local volumes so the databases were initialized with the corrected passwords.

### 2. Zitadel first-instance setup failure

Problem:

- The generated admin password did not satisfy Zitadel’s password complexity policy.

Fix:

- Replaced the local admin password with a compliant value and recreated the fresh local Zitadel data.

### 3. Zitadel internal/external hostname mismatch

Problem:

- Containers were calling Zitadel as `http://zitadel:8080`.
- Zitadel was configured for a different external domain, so discovery returned `404` during bootstrap.

Fix:

- Switched the shared local Zitadel URL to `http://auth.127.0.0.1.sslip.io:8080`.
- Added a Docker network alias on the `zitadel` service for `auth.127.0.0.1.sslip.io`.
- Updated `envsync_api` and `envsync_init` to consume `ZITADEL_URL` from env instead of hardcoding `http://zitadel:8080`.

### 4. `.localhost` was not usable inside containers

Problem:

- `auth.localhost` looked attractive for local development.
- Inside Bun containers it resolves to loopback by design, bypassing Docker service resolution.

Fix:

- Switched to `auth.127.0.0.1.sslip.io`.
- On the host it resolves to `127.0.0.1`.
- Inside Docker it resolves through the Compose network alias to the Zitadel service.

### 5. API crash on `/logs`

Problem:

- The `envsync_api` image runs as the `envsync` user.
- The logger resolves its log directory to `/logs` and tries to create it at container root.
- The process crashed with `EACCES: permission denied, mkdir '/logs'`.

Fix:

- Added a local-only compose override: `user: "0"` for `envsync_api`.
- This avoids changing application code while allowing the current image to start cleanly.

### 6. `prod-init.ts` blocks on HyperDX even when HyperDX is not part of the started stack

Problem:

- The init script always executes the HyperDX wait step.
- That makes bootstrap fail or stall even when HyperDX is not intended to run.

Workaround used:

- Started a temporary lightweight stub container on the Compose network with alias `hdx`.
- Let the init script finish.
- Removed the stub afterward.

Status:

- This is still an application/runtime bug worth fixing later in `prod-init.ts`.

## Infrastructure Issues Encountered

### 1. Kind did not work on this host

Observed failure:

- Docker runtime error around `/dev/mapper/control` permissions while creating the Kind cluster.

Impact:

- Helm manifests were linted and rendered successfully, but a live Kind validation was blocked by host runtime constraints.

### 2. k3d fallback also failed on this host

Observed failure:

- k3s exited with a cgroup-v2 cpuset error.

Impact:

- Local Kubernetes validation could not be completed on this machine even though the deployment scaffolding is in place.

## Current Local Runtime Shape

The working local self-hosting flow is:

1. Start core services with `docker compose -f docker-compose.prod.yaml up -d`.
2. Run bootstrap once with `docker compose -f docker-compose.prod.yaml run --rm envsync_init`.
3. Persist the generated Zitadel and OpenFGA values into local `.env`.
4. Start `envsync_api`.
5. Validate with `/health`, `/version`, and `/api/access/web`.

## Files Changed

Primary tracked files changed for this work:

- `.gitignore`
- `docker-compose.prod.yaml`
- `Makefile`
- `kind-config.yaml`
- `helm/envsync/**`
- `k8s/README.md`
- `k8s/Makefile`

This document:

- `docs/self-hosting-bringup-report.md`

## Known Follow-Ups

- Make HyperDX optional in `prod-init.ts` instead of requiring a runtime stub.
- Fix the logger/image mismatch so `envsync_api` does not need `user: "0"` in local compose.
- Validate the Helm chart on a host where Kind or another local Kubernetes runtime works.
- Decide whether the advanced operator-based `k8s/` path should be implemented now or kept deferred behind the Helm path.

## Important Note

No application source code was intentionally modified as part of this bring-up.

There was already an unrelated local change in:

- `apps/envsync-landing/src/utils/env.ts`

That file was left alone.
