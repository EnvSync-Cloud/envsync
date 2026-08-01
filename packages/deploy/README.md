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

## Enterprise

Private package `@envsync-cloud/deploy-enterprise` (`envsync-deploy-enterprise`) wraps
this engine with enterprise edition forced. Open-core direction: **EE → OSS**, never reverse.

## Build

```bash
bun run --filter @envsync-cloud/deploy build
bun run --filter @envsync-cloud/deploy test
```
