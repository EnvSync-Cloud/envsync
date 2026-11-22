# EnvSync Web

Dashboard shell at `apps/envsync-web` (React, Vite, Tailwind). Agent notes: [AGENTS.md](./AGENTS.md).

- OSS build: `bun run build:oss` — enterprise modules resolve to an empty stub.
- Enterprise build: `bun run build:enterprise`.
- Hosted build: `bun run build:hosted` — enterprise modules plus hosted deployment mode.
- API client: `@envsync-cloud/envsync-ts-sdk` only. `BASE` is the API origin. Manage calls use `/api/v1/manage/...` on that origin.

There is no separate management SPA.

## Develop

From the monorepo root, with Compose and `bun run cli:init` already done (see the root [README](../../README.md)):

```bash
bun run --filter envsync-web dev
```

Open `http://app.lvh.me:8001`. Do not use `http://localhost:8001` for sign-in. The API allows the `app.lvh.me` origin, and Atrium sets the session cookie for `lvh.me`.

Runtime config is `window.__ENVSYNC_RUNTIME_CONFIG__` (`src/utils/runtime-config.ts`). `VITE_API_BASE_URL` is the fallback API origin. Hosted and self-host builds write the rest (app URL, auth URL, edition, deployment mode) into `public/runtime-config.js`.

## Scripts

```bash
bun run dev
bun run build:oss
bun run build:enterprise
bun run build:hosted
bun run lint
bun run preview
```

UI checks live on the `ui:*` scripts in `package.json` (`ui:smoke`, `ui:regression`, and the journey scripts). They are Playwright runs, separate from `packages/envsync-api` E2E.

## Layout

```text
src/
  pages/         # feature directories
  components/    # shared UI, including components/ui
  api/           # React Query hooks
  modules/       # dashboard route registration
  layout/
  hooks/
  utils/         # runtime config
```

Enterprise pages are injected from `packages/envsync-enterprise-web` on enterprise and hosted builds.

## License

The shell is on the MIT side of the monorepo. See the root [LICENSE](../../LICENSE) and [EDITIONING.md](../../EDITIONING.md).
