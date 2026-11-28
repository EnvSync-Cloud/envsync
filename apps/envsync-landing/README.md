# EnvSync Landing

Hosted marketing site at `apps/envsync-landing`. Self-host OSS and Enterprise stacks do not run this app. See [EDITIONING.md](../../EDITIONING.md).

The dev server is forced to the dark theme. The home page is `src/pages/Index.tsx`, which renders `src/components/home/HomeLanding.tsx`.

## Develop

From the monorepo root:

```bash
bun install
bun run --filter envsync-landing dev
```

Open `http://localhost:8002`.

Vite reads the root `.env` when those variables are set. Local defaults in `src/utils/runtime-config.ts` are enough to boot the page:

| Variable | Role | Local fallback |
|----------|------|----------------|
| `VITE_API_BASE_URL` | API origin | `http://localhost:4000` |
| `VITE_DOCS_URL` | Docs site | `https://docs.envsync.cloud` |
| `VITE_API_DOCS_URL` | API reference | `{docs}/api` |
| `VITE_CONTACT_HREF` | Contact link | `mailto:team@envsync.cloud` |

Hosted builds inject `window.__ENVSYNC_RUNTIME_CONFIG__`. Do not add a second `.env` inside this app.

## Scripts

```bash
bun run dev       # Vite on port 8002
bun run build     # production build
bun run preview
bun run lint
```

`bun run deploy` builds and runs Wrangler. Hosted frontend publish from GitHub is the root `deploy-fe` workflow, not this script.

## Layout

```text
src/
  pages/            # routes (home, pricing, onboarding, product, companies)
  components/home/  # home page sections and motion
  components/       # header, footer, shared marketing components
  content/          # product and company page copy
  utils/            # runtime config
```

## Stack

React, Vite, Tailwind, and the shared `envsync-ui` tokens. The page calls `@envsync-cloud/envsync-ts-sdk` only. Fonts are Inter and JetBrains Mono.

## License

Part of the public monorepo. See the root [LICENSE](../../LICENSE).
