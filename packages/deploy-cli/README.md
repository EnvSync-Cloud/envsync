# @envsync-cloud/deploy-enterprise

**License:** Proprietary (UNLICENSED)  
**Binary:** `envsync-deploy-enterprise`  
**Private registry:** GitHub Packages

Enterprise self-host deploy CLI. **Thin wrapper** over the MIT engine in
`@envsync-cloud/deploy` — does not host a parallel codebase.

```text
packages/deploy (OSS engine)  ←──  packages/deploy-cli (this package, EE entry)
```

```ts
process.env.ENVSYNC_DEPLOY_FORCE_EDITION = "enterprise";
await import("@envsync-cloud/deploy/cli");
```

## Install (private)

```bash
npm i -g @envsync-cloud/deploy-enterprise --registry=https://npm.pkg.github.com
envsync-deploy-enterprise --help
```

## Build

```bash
bun run --filter @envsync-cloud/deploy build
bun run --filter @envsync-cloud/deploy-enterprise build
```
