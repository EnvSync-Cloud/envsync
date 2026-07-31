# Edition structure (dual-license monorepo)

EnvSync is a **public monorepo** with a dual license (MIT + proprietary enterprise),
not a “private superset only” model. Enterprise packages live in-tree under a
proprietary license; OSS builds must not depend on them.

## Product matrix

| | Hosted Enterprise | Self-host OSS | Self-host Enterprise |
|--|-------------------|---------------|----------------------|
| `ENVSYNC_DEPLOYMENT_MODE` | `hosted` | `selfhosted` | `selfhosted` |
| `ENVSYNC_EDITION` | `enterprise` | `oss` | `enterprise` |
| Public org signup (landing) | Yes | No | No |
| Multi-org | Yes (SaaS) | No (`max_orgs=1`) | Licensed claims only (default 1) |
| First org | Landing / hosted dashboard | Bootstrap / OSS deploy CLI | EE deploy CLI |
| Further orgs | Dashboard **Organization** create | Never | EE deploy CLI + entitlement |
| Landing service | Separate (Cloudflare) | No | No |
| Management API process | EnvSync-operated | No | Yes |
| License authority | Platform billing | N/A | Entitlement JWT / cert (public verify key) |
| Deploy tool | N/A | `@envsync-cloud/deploy` | `@envsync-cloud/deploy-enterprise` |
| Dashboard | `envsync-web` + EE modules | `envsync-web` OSS build | `envsync-web` EE build |
| Management SPA | **None** (deleted) | None | None |

Full program decisions: [docs/plans/2026-08-no-piggyback-program.md](./docs/plans/2026-08-no-piggyback-program.md).

## Package graph (simplified)

```text
MIT
  envsync-kernel
  envsync-api          (core process + loaders)
  deploy / deploy-core
  apps/envsync-web     (shell; OSS stub for EE modules)
  apps/envsync-landing

PROPRIETARY
  envsync-enterprise       (management module registry)
  envsync-enterprise-web   (dashboard WebModule[] + pages)
  envsync-management-api   (management process)
  deploy-cli               (npm: deploy-enterprise)
```

## How edition injection works

### API

- Core process: `loadApiModules("core")` — never imports `envsync-enterprise`.
- Management process: registers `enterpriseManagementModules` from `envsync-enterprise`.
- Feature gates (Phase 4): verified entitlements when `ENVSYNC_LICENSE_ENFORCEMENT=true`.

### Frontend

- OSS: Vite `@enterprise-modules` → empty stub.
- Enterprise: `@enterprise-modules` → `packages/envsync-enterprise-web`.
- Shell chrome is shared; EE pages import UI via `@shell/*`.

### Deploy

- Public `@envsync-cloud/deploy` is self-contained OSS (no monorepo spawn).
- Enterprise deploy is a separate private package/bin.

## Optional private-superset workflow

A private repo that only holds secrets/signing keys or additional closed modules
remains **optional**. The default product story is:

1. Public monorepo dual license (this document).
2. Private license-server for entitlement signing (keys never in the monorepo).

If you maintain a private superset, keep public as upstream and never import
proprietary packages from MIT package production graphs.

## Guardrails

- MIT packages must not list proprietary packages as **production** dependencies
  (CI: `bun run check:boundaries`).
- Self-host **web** must never create organizations (any edition).
- Multi-org on self-host EE is **CLI + entitlement claims**, not cookie sessions.
- Do not reintroduce `apps/envsync-management-web` or `/manage` merge.

## Vocabulary

| Term | Meaning |
|------|---------|
| **Organization** | Tenant boundary (DB `orgs`). Use this in product UI. |
| **Workspace** | Deprecated as multi-org alias. Use Organization; `create-workspace` HTTP alias removed (Phase 7). |
| **Project / App** | Work unit under one org. |
