# Phase 3 — Deploy CLI product split

**Branch:** `feat/the-big-update-p3`  
**Program:** [../2026-08-no-piggyback-program.md](../2026-08-no-piggyback-program.md)

## Delivered

| Package | npm name | Bin | Registry |
|---------|----------|-----|----------|
| `packages/deploy` | `@envsync-cloud/deploy` | `envsync-deploy` | public npm |
| `packages/deploy-cli` | `@envsync-cloud/deploy-enterprise` | `envsync-deploy-enterprise` | GitHub Packages (restricted) |
| `packages/deploy-core` | `@envsync-cloud/deploy-core` | library | public npm |

### OSS self-contained artifact

- `packages/deploy` **bundles** `deploy-cli` lifecycle at build time with `ENVSYNC_DEPLOY_FORCE_EDITION=oss`
- **No** `spawnSync` monorepo path
- Dist asserts no `packages/deploy-cli/src` spawn strings
- OSS web image: `envsync-web-oss-static`
- License CLI commands refused under OSS force

### Enterprise

- Distinct bin name (no collision with OSS)
- `publishConfig.access: restricted` + GitHub Packages registry
- release.yml publishes with `GITHUB_TOKEN`, not public npm

### Docs

- `SELFHOSTING.md` documents `@envsync-cloud/deploy` for OSS
- Package READMEs updated

## Acceptance

- [x] OSS dist self-contained + force edition oss  
- [x] Enterprise package renamed + private publish config  
- [x] Distinct bins  
- [x] OSS image matrix uses web-oss-static  
- [x] Landing remains off self-host (Phase 2)  
- [ ] Full host smoke (`selfhost:smoke:oss`) — run on Swarm host when available  

## Note on monorepo path

Enterprise sources remain under `packages/deploy-cli/` for history/CI paths; **npm package name** is `@envsync-cloud/deploy-enterprise`. Physical folder rename is optional later cleanup.
