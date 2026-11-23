# Self-Hosting EnvSync (OSS)

> **Full multi-edition guide:** [DEPLOY.md](./DEPLOY.md) (Hosted + self-host OSS + self-host Enterprise).

## Who this is for

This guide is for operators deploying **OSS** EnvSync on a single Ubuntu or Debian Docker Swarm host.

For **Enterprise** self-host, use the private package `@envsync-cloud/deploy-enterprise` (`envsync-deploy-enterprise`) from GitHub Packages — not this public flow. See [DEPLOY.md § Self-host Enterprise](./DEPLOY.md#3-self-host-enterprise).

## Requirements

- one public Linux host with root or sudo access
- Docker Swarm manager node
- public DNS for the app/api/auth (and optional obs/s3) subdomains
- ports `80` and `443` available on the host
- exact EnvSync release version to deploy

## DNS / hostnames

Recommended public hosts:

- `app.<root-domain>` for the dashboard
- `api.<root-domain>` for the API (product **and** Enterprise manage at `/api/v1/manage/...`)
- `auth.<root-domain>` for Atrium
- `obs.<root-domain>` for ClickStack (if observability enabled)
- `t.<root-domain>` for first-party analytics (`/ph` → PostHog, `/obs` → OTLP)
- `s3.<root-domain>` for the S3-compatible API
- `console.s3.<root-domain>` for the object storage console

There is **no** separate `manage-api.<root-domain>` service. Enterprise self-host uses the enterprise API image (`envsync-api-enterprise`) with manage routes on the same API host.

Self-host does **not** require a marketing landing host. Public signup is Hosted-only.

Product analytics (PostHog) is optional. If `POSTHOG_KEY` / `VITE_POSTHOG_KEY` are set, the API and dashboard send **non-secret** product events (creates, invites, SSO, KMS attach — never env/secret values). Set `ENVSYNC_POSTHOG_DISABLED=true` to turn this off.

## Deploy CLI flow (OSS)

Prepare the host:

```bash
npx @envsync-cloud/deploy preinstall
```

Create `/etc/envsync/deploy.yaml`:

```bash
npx @envsync-cloud/deploy setup
```

Bootstrap the managed infra:

```bash
npx @envsync-cloud/deploy bootstrap
```

Deploy the pinned release:

```bash
npx @envsync-cloud/deploy deploy
```

### First organization (required)

Self-host has **no public signup** and **no dashboard “create organization”**.  
Create the first org with the operator CLI (setup token under `/etc/envsync/setup.token`):

```bash
# Interactive (TTY)
envsync-deploy org create --interactive

# Non-interactive
envsync-deploy org create \
  --name "Acme" \
  --email "admin@example.com" \
  --password 'Str0ng!Pass'

# Status
envsync-deploy org status
envsync-deploy health --json   # includes first_org.ready
```

- OSS: at most one organization.
- Enterprise self-host: one org by default; further orgs only via `org create` when license/`ENVSYNC_MAX_ORGS` allows (not via web). Use `envsync-deploy-enterprise`.

Important facts:

- `setup` writes the desired self-host config (edition **oss** for this package).
- `bootstrap` is destructive and rebuilds the managed EnvSync infra.
- `bootstrap` / deploy may prompt for the first org when a TTY is available.
- `deploy` performs the release rollout.
- running `envsync-deploy` with no subcommand shows the current status and the recommended next step.

## Swarm service topology

Swarm self-host runs two miniKMS tasks. Both tasks share one Postgres service and one Redis service. Each of those database services is one container with a data volume.

miniKMS and Atrium update start-first: Swarm starts the replacement task, waits for its healthcheck, and then stops the previous task. A failed healthcheck rolls that service back to the previous task. miniKMS checks TCP port 50051. Atrium checks HTTP `GET /health` and stays at one task. API blue/green is the API slot pair (`envsync_api_blue` and `envsync_api_green`).

Postgres is pinned to `postgres:17.12`. Redis is pinned to `redis:7.4.12`. The same tags are used for `postgres`, `atrium_db`, `openfga_db`, `minikms_db`, Redis, and the CLI helpers that wait on or migrate those databases. Digests are recorded in [packages/deploy/versions.lock.json](./packages/deploy/versions.lock.json) and written to the host `versions.lock.json` during deploy.

miniKMS schema changes run once, as a CLI job (`001` through `007`). They are not part of the miniKMS service command. Atrium applies its database migrations when the task starts (`database.migrations: true`).

The Atrium image has no shell. Deploy copies a static BusyBox binary from `busybox:1.36.1-musl` into the host deploy directory and mounts it at `/busybox` so the `/health` check can run. The copy matches the architecture of the Swarm node that runs deploy.

`docker compose` uses the same Postgres and Redis tags. Compose files do not set Swarm replica counts or rolling-update policy.

## Upgrade / rollback

Upgrade to the running deploy package version:

```bash
bunx @envsync-cloud/deploy@0.20.0 upgrade
```

Upgrade to an exact target:

```bash
bunx @envsync-cloud/deploy@0.20.0 upgrade 0.20.0
```

Blue/green behavior:

- the inactive API slot is updated first
- traffic promotes only after the candidate slot is ready
- the previous API slot stays available for rollback

Manual slot control:

```bash
envsync-deploy promote
envsync-deploy rollback
```

## Backup / restore

Create an encrypted data backup. The default is age. The archive is `envsync-backup-<time>.tar.gz.age`. The identity file is written beside it as `envsync-backup-<time>.identity` and is not inside the archive. Keep that identity file with your other operator secrets. The file mode is `0600`.

A data backup does not include the miniKMS root key, session-signing key, or private PEMs. Those stay in a separate key bundle. The archive manifest records that keys were excluded.

```bash
envsync-deploy backup
envsync-deploy export-keys
```

`export-keys` writes `envsync-keys-<time>.tar.gz.age` (mode `0600`) and a separate identity file (mode `0600`). Store the bundle and its identity offline, apart from the data backup. Optional `backup.recipients` in the deploy config adds extra age recipients. Pass `--output` and `--identity` to choose the paths. `--dry-run` prints paths only.

To put keys inside a data backup anyway, pass `--include-keys`. That still requires age encryption.

`backup.encrypted` defaults to `true`. An unencrypted `.tar.gz` is refused. To write one anyway, set `backup.encrypted: false` in the deploy config and pass the insecure flag:

```bash
envsync-deploy backup --insecure-unencrypted
```

A normal backup also encrypts any older `envsync-backup-*.tar.gz` files in the output directory and removes the unencrypted copies. Each of those gets its own `.identity` file beside the new `.age` archive. The same run seals unencrypted `envsync-db-preupgrade-*.dump` files and deletes upgrade snapshots older than `upgrade.snapshot_retention_days` (default 7).

Upgrade snapshots are age-encrypted after `pg_dump` (file mode `0600`, directory mode `0700`). A successful upgrade deletes the snapshot and its identity.

Restore an encrypted archive. If the identity file is next to the archive, you can omit `--identity`. When the data backup excluded keys, pass the export-keys bundle. Restore fails if those keys are in neither the archive nor the bundle.

```bash
envsync-deploy restore /path/to/envsync-backup.tar.gz.age \
  --identity /path/to/envsync-backup.identity \
  --keys /path/to/envsync-keys.tar.gz.age \
  --keys-identity /path/to/envsync-keys.identity
```

Restore and start services immediately:

```bash
envsync-deploy restore /path/to/envsync-backup.tar.gz.age --keys /path/to/envsync-keys.tar.gz.age --deploy
```

## Troubleshooting / health

Human-friendly health view:

```bash
envsync-deploy health
```

Machine-readable health:

```bash
envsync-deploy health --json
```

The health output shows:

- bootstrap state
- active and rollback API slots
- service health for API, web, and observability
- first organization readiness
- public URLs

## Local smoke for maintainers

Before publishing deploy package changes from the monorepo:

```bash
bun run selfhost:smoke:oss
```

## Related paths

- [packages/deploy](./packages/deploy) — public OSS CLI (`@envsync-cloud/deploy`)
- [packages/deploy-cli](./packages/deploy-cli) — enterprise sources published as `@envsync-cloud/deploy-enterprise`
- [docker/atrium](./docker/atrium) — Atrium config, clients, and branding

## Enterprise license (self-host)

Enterprise self-host requires a valid license install (entitlement JWT and/or certificate bundle under the paths configured by deploy). Verify with the enterprise deploy CLI and license controls in the dashboard (`/organisation/license`). Hosted SaaS uses platform billing instead of customer-side license files.
