# EnvSync Web Dashboard

React web dashboard for managing environments, secrets, teams, and access control.

## Stack

- **Framework:** React 18 + TypeScript
- **Build:** Vite 7
- **Styling:** TailwindCSS 3 + Radix UI primitives (shadcn-style components in `src/components/ui/`)
- **Data fetching:** TanStack React Query v5
- **Forms:** React Hook Form + Zod validation
- **Routing:** React Router v6
- **Icons:** Lucide React
- **Deployment:** Cloudflare Workers via Wrangler (`wrangler.jsonc`)

## Project structure

```
src/
  App.tsx                # root component with router setup
  main.tsx               # entry point
  pages/                 # route pages
  components/            # shared components
  components/ui/         # shadcn-style primitives (Radix + Tailwind)
  api/                   # React Query queries and mutations
  contexts/              # React Context providers (auth, global state)
  hooks/                 # custom hooks
  layout/                # layout components
  lib/                   # utility library (cn, etc.)
  constants/             # app constants
  utils/                 # helper functions
```

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Vite dev server |
| `bun run build` | Production build |
| `bun run lint` | ESLint |
| `bun run deploy` | Build + deploy to Cloudflare Workers |

## SDK

Uses `@envsync-cloud/envsync-ts-sdk` (workspace link) for API types and client. Import types and API client from the SDK — do not duplicate API types locally.

## Conventions

- Server state managed via React Query — queries/mutations in `src/api/`
- Client state via React Context in `src/contexts/`
- Only `VITE_*` env vars are exposed to the client (Vite convention). `VITE_API_BASE_URL` is the primary one
- UI components follow shadcn patterns: Radix primitive + Tailwind styling in `src/components/ui/`
