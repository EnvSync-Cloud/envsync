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
- `auth.<root-domain>` for Keycloak
- `obs.<root-domain>` for ClickStack (if observability enabled)
- `s3.<root-domain>` for the S3-compatible API
- `console.s3.<root-domain>` for the object storage console

There is **no** separate `manage-api.<root-domain>` service. Enterprise self-host uses the enterprise API image (`envsync-api-enterprise`) with manage routes on the same API host.

Self-host does **not** require a marketing landing host. Public signup is Hosted-only.

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

Create a backup archive:

```bash
envsync-deploy backup
```

Restore a backup archive:

```bash
envsync-deploy restore /path/to/envsync-backup.tar.gz
```

Restore and start services immediately:

```bash
envsync-deploy restore /path/to/envsync-backup.tar.gz --deploy
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
- [packages/envsync-keycloak-theme](./packages/envsync-keycloak-theme)

## Enterprise license (self-host)

Enterprise self-host requires a valid license install (entitlement JWT and/or certificate bundle under the paths configured by deploy). Verify with the enterprise deploy CLI and license controls in the dashboard (`/organisation/license`). Hosted SaaS uses platform billing instead of customer-side license files.
