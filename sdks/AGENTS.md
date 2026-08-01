# EnvSync SDKs

Both SDKs are **auto-generated** from the unified API OpenAPI spec (`GET /openapi` on the core process). Do **not** hand-edit generated source.

Manage surface (`/api/v1/manage/{module}/...`, Enterprise) is included in the **same** SDK packages as core product routes. There is no separate management SDK.

## TypeScript SDK (`envsync-ts-sdk`)

- Generated with `openapi-typescript-codegen`
- **Regenerate:** `bun run generate:local` (in `sdks/envsync-ts-sdk/`) — runs monorepo `packages/envsync-api/scripts/export-openapi.ts` by default
- **Build:** `bun run build` (tsup)
- Published as `@envsync-cloud/envsync-ts-sdk`
- `BASE` = API origin (e.g. `http://localhost:4000`); manage methods use full `/api/v1/manage/...` paths
- Consumed by `apps/envsync-web`, `envsync-enterprise-web`, landing

## Go SDK (`envsync-go-sdk`)

- Generated with Fern (`./generator.sh`)
- Spec: copy/export `openapi.json` from the same export script as TS
- Consumed by `packages/envsync-cli`

## Workflow

1. Change API routes in `envsync-api` / `envsync-enterprise`
2. Ensure OpenAPI operationIds are unique (`openapi-disambiguate` + tests)
3. Regenerate TS (+ copy openapi to go-sdk and run Fern)
4. Rebuild consumers

Do not reintroduce `sdks/envsync-management-*` packages.
