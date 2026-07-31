# Phase 0.4–0.5 — Frontend inventory (management-web + tokens)

**Branch:** `feat/the-big-update-p0`  
**Targets:** D9–D12

## 0.4 `envsync-management-web` → future dashboard modules

**App:** `apps/envsync-management-web` (~1.5k LOC, separate Vite SPA)  
**Merge:** `scripts/merge-management-web-dist.ts` → `apps/envsync-web/dist/manage`  
**SDK:** `@envsync-cloud/envsync-management-ts-sdk`

| Screen / capability | API surface | Target dashboard home (after P5c) |
|---------------------|-------------|-----------------------------------|
| System status | `GET` management system status | Settings → System / Deployment |
| License activate / verify / message | License service | Settings → **License** (EE module) |
| Provider connections list/create | Enterprise providers | Organisation → **Integrations** (extend existing EE integrations nav) |
| Org secrets list/create | Org secrets API | Organisation → **Integrations** / Secrets |
| Sync runs list + filters | Sync runs | Organisation → **Integrations** → Sync history |
| Sync audit events for run | Sync audit | Same |
| Manual sync run | Manual sync | Same |
| Provider form configs (GitHub, GitLab, AWS SSM, Vercel, GSM) | — | Shared with `ProjectIntegrations` patterns |

**Disposition:** Delete app after parity in `envsync-enterprise-web` modules injected into `envsync-web`. No long-term `/manage` subtree.

## FE module injection today

| File | Role | Gap |
|------|------|-----|
| `apps/envsync-web/src/modules/core-modules.ts` | Core routes | OK |
| `enterprise-modules.ts` + Vite `@enterprise-modules` | EE routes when not OSS build | Pages still **in** envsync-web tree |
| `enterprise-modules.stub.ts` | OSS empty modules | Build-time only |
| `external-modules.ts` | Empty FOSS hook | Unused |

**Target (P5b):** `packages/envsync-enterprise-web` exports `WebModule[]`; OSS build omits package.

## 0.5 Design token duplication

| App | Token source | Notes |
|-----|--------------|-------|
| `envsync-web` | `src/index.css` CSS variables + `tailwind.config.ts` | Full set light/dark, sidebar tokens |
| `envsync-landing` | `src/index.css` + own `tailwind.config.ts` | Parallel `--primary` etc.; some values differ (e.g. background/card) |
| `envsync-management-web` | `src/styles.css` ad-hoc | Not aligned with design system |

**Shared brand anchors (approx):** `--primary: 153 74% 44%`, similar radius/destructive.

**Target (early parallel / D12):** `packages/envsync-ui` owns CSS variables + Tailwind preset; web + landing import; management-web not migrated (deleted).

## UI primitive counts (rough)

| App | `components/ui` |
|-----|-----------------|
| envsync-web | ~57 shadcn-style |
| envsync-landing | ~10 |
| envsync-management-web | 0 (custom CSS) |

`envsync-ui` v1 = **tokens first**, not full primitive merge.
