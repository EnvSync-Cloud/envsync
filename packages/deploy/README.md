# `@envsync-cloud/deploy`

Public **OSS** self-host deploy CLI for EnvSync on Docker Swarm.

## Install

```bash
npx @envsync-cloud/deploy preinstall
npx @envsync-cloud/deploy setup
npx @envsync-cloud/deploy bootstrap
npx @envsync-cloud/deploy deploy
npx @envsync-cloud/deploy org create --interactive
```

Binary: `envsync-deploy`

## What this package includes

- Full OSS lifecycle: preinstall, setup, bootstrap, deploy, health, backup, org create/status
- Forced edition: **oss** (no management API, no landing, no enterprise license commands)
- Dashboard image: `envsync-web-oss-static`
- Setup-token first org create (no public signup)

## What it does **not** include

- Enterprise license certificate issue/renew
- Management API topology
- Marketing landing service

For Enterprise self-host, use the private package `@envsync-cloud/deploy-enterprise` (`envsync-deploy-enterprise`).

## Packaging

This package **bundles** the deploy engine at build time. The published tarball is self-contained and does **not** spawn monorepo paths into `deploy-cli` sources.

See `docs/plans/2026-08-no-piggyback-program.md` Phase 3.
