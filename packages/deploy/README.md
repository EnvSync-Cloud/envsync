# @envsync-cloud/deploy

**License:** MIT  
**Binary:** `envsync-deploy`

Public OSS CLI for self-hosted EnvSync on Docker Swarm.

## Independence (no piggyback)

This package **owns** the deploy engine (`src/cli.ts` + helpers). It does **not** import
or spawn `packages/deploy-cli` / `@envsync-cloud/deploy-enterprise`.

| Package | Role |
|---------|------|
| `@envsync-cloud/deploy` | OSS engine + `envsync-deploy` bin |
| `@envsync-cloud/deploy-enterprise` | Thin EE entry: forces `edition=enterprise`, depends on this package |
| `@envsync-cloud/deploy-core` | Shared plan/schema primitives |

## Install

```bash
npm i -g @envsync-cloud/deploy
envsync-deploy --help
```

Full operator guide (OSS + Enterprise + Hosted): monorepo root [DEPLOY.md](../../DEPLOY.md).

## Enterprise

Private package `@envsync-cloud/deploy-enterprise` (`envsync-deploy-enterprise`) wraps
this engine with enterprise edition forced. Open-core direction: **EE → OSS**, never reverse.

Enterprise stacks run a **single API service** with manage routes at `/api/v1/manage/...` on the API host (no separate management-api container). Frontend `managementApiUrl` points at `{apiBaseUrl}/api/v1/manage`.

## Backup and key custody

`envsync-deploy backup` writes an age-encrypted data backup. MiniKMS private keys are excluded. `envsync-deploy export-keys` writes a separate age-encrypted key bundle (mode `0600`) and identity file (mode `0600`) for offline storage. Restore a data backup with `--keys` and `--keys-identity`. Upgrade DB snapshots are age-encrypted and pruned after `upgrade.snapshot_retention_days` (default 7).

## Build

```bash
bun run --filter @envsync-cloud/deploy build
bun run --filter @envsync-cloud/deploy test
```
