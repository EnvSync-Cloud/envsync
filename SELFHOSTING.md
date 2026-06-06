# Self-Hosting EnvSync

## Who this is for

This guide is for operators deploying EnvSync on a single Ubuntu or Debian Docker Swarm host.

## Requirements

- one public Linux host with root or sudo access
- Docker Swarm manager node
- public DNS for the root domain and subdomains
- ports `80` and `443` available on the host
- exact EnvSync release version to deploy

## DNS / hostnames

Recommended public hosts:

- `<root-domain>` for landing
- `app.<root-domain>` for the dashboard
- `api.<root-domain>` for the API
- `auth.<root-domain>` for Keycloak
- `obs.<root-domain>` for ClickStack
- `s3.<root-domain>` for the S3-compatible API
- `console.s3.<root-domain>` for the object storage console

## Deploy CLI flow

Prepare the host:

```bash
npx @envsync-cloud/deploy-cli preinstall
```

Create `/etc/envsync/deploy.yaml`:

```bash
npx @envsync-cloud/deploy-cli setup
```

Bootstrap the managed infra:

```bash
npx @envsync-cloud/deploy-cli bootstrap
```

Deploy the pinned release:

```bash
npx @envsync-cloud/deploy-cli deploy
```

Important facts:

- `setup` writes the desired self-host config.
- `bootstrap` is destructive and rebuilds the managed EnvSync infra.
- `deploy` performs the release rollout.
- running `envsync-deploy` with no subcommand shows the current status and the recommended next step.

## Upgrade / rollback

Upgrade to the running deploy-cli package version:

```bash
bunx @envsync-cloud/deploy-cli@0.6.26 upgrade
```

Upgrade to an exact target:

```bash
bunx @envsync-cloud/deploy-cli@0.6.26 upgrade 0.6.25
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
- service health for API, web, landing, and observability
- ClickStack source/search readiness
- public URLs

## Local smoke for maintainers

Before publishing deploy-cli changes from the monorepo:

```bash
bun run selfhost:smoke
```

## Related paths

- [packages/deploy-cli](./packages/deploy-cli)
- [packages/deploy-cli/src/index.ts](./packages/deploy-cli/src/index.ts)
- [packages/envsync-keycloak-theme](./packages/envsync-keycloak-theme)
