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
| Manage surface (`/api/v1/manage`) | Same core API process | No | Same core API (EE image / modules) |
| Separate management API process | **No** | No | **No** (removed) |
| License authority | Platform billing | N/A | Entitlement JWT / cert (public verify key) |
| Deploy tool | N/A | `@envsync-cloud/deploy` | `@envsync-cloud/deploy-enterprise` |
| Dashboard | `envsync-web` + EE modules | `envsync-web` OSS build | `envsync-web` EE build |
| SDKs | Core TS/Go only | Core TS/Go | Core TS/Go (manage paths included) |
| Management SPA | **None** | None | None |

Agent-facing product facts: root [AGENTS.md](./AGENTS.md). Detailed planning notes under local `docs/` are gitignored.

## Package graph (simplified)

```text
MIT
  envsync-kernel
  envsync-api          (core process + loaders)
  deploy / deploy-core
  apps/envsync-web     (shell; OSS stub for EE modules)
  apps/envsync-landing

PROPRIETARY
  envsync-enterprise       (management modules + EE services/engines/migrations)
  envsync-enterprise-web   (dashboard WebModule[] + pages)
  (manage surface on core API: /api/v1/manage — no second process)
  deploy-cli               (npm: deploy-enterprise)
```

EE services (OIDC, SAML, rotation, dynamic secrets, integrations, log-forwarding) and
their migrations live under `envsync-enterprise`. `envsync-api` keeps thin monorepo
re-export shims only (no production package.json dependency).

## How edition injection works

### API

- Core process: `loadApiModules("core")` — never imports `envsync-enterprise`.
- Management process: registers `enterpriseManagementModules` from `envsync-enterprise`.
- Feature gates (Phase 4): verified entitlements when `ENVSYNC_LICENSE_ENFORCEMENT=true`.

### Frontend

- OSS: Vite `@enterprise-modules` → empty stub.
- Enterprise / Hosted: `@enterprise-modules` → `packages/envsync-enterprise-web`
  (`build:enterprise` / `build:hosted`). Hosted CF **must not** use `build:oss`.
- `envsync-enterprise-web` is a **devDependency** of `envsync-web` (not a production dep)
  so MIT production graphs stay free of proprietary packages; monorepo Vite still resolves it.
- Shell chrome is shared; EE pages import UI via `@shell/*`.
- Design tokens: MIT `envsync-ui` (do not fork `:root` in apps).

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
