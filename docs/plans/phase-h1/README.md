# H1 — Hosted ship blockers

**Branch:** `feat/the-big-update-h1`  
**Plan:** [../2026-08-post-program-hardening.md](../2026-08-post-program-hardening.md)

## Delivered

| ID | Change |
|----|--------|
| H1.1 | `deploy-fe.yaml`: Hosted web uses `build:hosted` (enterprise modules); path filter includes `envsync-enterprise-web` |
| H1.1 | `apps/envsync-web` script `build:hosted` (= enterprise Vite license) |
| H1.2 | TS + Go SDKs: `createOrganization` → `POST /api/auth/create-organization`; `createWorkspace` deprecated wrapper (same path) |
| H1.2 | `openapi.json` paths updated in both public SDKs |
| H1.3–H1.4 | Cutover runbook below |
| H1.5 | `check:boundaries` guards for deploy-fe + SDK paths |

## Hosted cutover order

```text
1. Deploy API (+ management-api if separate)
2. Smoke: POST /api/auth/create-organization (hosted session)
3. Confirm SDKs on create-organization (this PR)
4. CF web via deploy-fe (build:hosted) — enterprise modules present
5. CF landing if needed
6. Remove any /manage reverse-proxy leftovers
7. UI e2e: organization-switcher / create-organization testids
```

## Hosted runtime (reminder)

| Var | Value |
|-----|--------|
| `ENVSYNC_DEPLOYMENT_MODE` | `hosted` |
| `ENVSYNC_EDITION` | `enterprise` |
| `ENVSYNC_LICENSE_ENFORCEMENT` | typically `false` (platform billing; feature gates host-bypass) |
| FE build | `build:hosted` / `VITE_SERVER_LICENSE=enterprise` |

Self-host OSS images remain `build:oss` in `release.yml` — unchanged.

## Acceptance

- [x] deploy-fe not `build:oss`  
- [x] SDK no live request URL `create-workspace`  
- [x] boundary CI covers both  
- [ ] Staging smoke after deploy (ops)  

## Verify

```sh
bun run check:boundaries
rg -n "build:oss" .github/workflows/deploy-fe.yaml   # expect no match for envsync-web
rg -n "url: '/api/auth/create-workspace'" sdks/envsync-ts-sdk/src  # expect no match
```
