# `@envsync-cloud/deploy-enterprise`

**Private** Enterprise self-host deploy CLI for EnvSync on Docker Swarm.

> Published to GitHub Packages (`npm.pkg.github.com`), not the public npm registry.

## Install (private registry)

```bash
# configure @envsync-cloud scope for GitHub Packages, then:
npx @envsync-cloud/deploy-enterprise preinstall
npx @envsync-cloud/deploy-enterprise setup
npx @envsync-cloud/deploy-enterprise bootstrap
npx @envsync-cloud/deploy-enterprise deploy
npx @envsync-cloud/deploy-enterprise org create --interactive
```

Binary: `envsync-deploy-enterprise`

## Product scope

- Enterprise edition topology (management API, license mounts)
- Landing **omitted** by default (Hosted-only marketing)
- License certificate issue / renew / validate
- Org create via setup token (CLI only; no dashboard org factory)

## OSS operators

Use public **`@envsync-cloud/deploy`** (`envsync-deploy`) instead.

## Monorepo layout

Sources remain under `packages/deploy-cli/` for historical paths; the npm package name is `@envsync-cloud/deploy-enterprise`.
