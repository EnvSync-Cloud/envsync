# H5 — `envsync-ui` design tokens (D12)

**Branch:** `feat/the-big-update-h5`  
**Plan:** [../2026-08-post-program-hardening.md](../2026-08-post-program-hardening.md)

## Delivered

| ID | Change |
|----|--------|
| H5.1 | `packages/envsync-ui` — MIT tokens.css + Tailwind preset |
| H5.2 | `envsync-web` + `envsync-landing` import tokens + use preset |
| H5.3 | Web content scan includes `envsync-enterprise-web` for EE classes |
| H5.4 | Apps no longer fork `:root` / `.dark` token blocks |

## Package exports

- `envsync-ui/tokens.css`
- `envsync-ui/tailwind-preset`

## Acceptance

- [x] Single brand primary `153 74% 44%`  
- [x] Web + landing consume package  
- [x] Unit tests for tokens + preset  

## Verify

```sh
cd packages/envsync-ui && bun test
cd apps/envsync-web && bun run build:hosted
```
