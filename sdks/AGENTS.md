# EnvSync SDKs

Both SDKs are **auto-generated** from the API's OpenAPI spec. Do NOT hand-edit source files.

## TypeScript SDK (`envsync-ts-sdk`)

- Generated with `openapi-typescript-codegen` from the API's OpenAPI spec
- **Regenerate:** `bun run generate:local` (in `sdks/envsync-ts-sdk/`)
- **Build:** `bun run build` (uses tsup)
- Published to npm as `@envsync-cloud/envsync-ts-sdk`
- Consumed by `apps/envsync-web` (workspace link) and `apps/envsync-landing` (npm)
- Generated source in `src/`, build output in `dist/`

## Go SDK (`envsync-go-sdk`)

- Generated with Fern (`buildwithfern.com`)
- Config in `fern/`, source spec: `openapi.json`
- **Regenerate:** `./generator.sh` (in `sdks/envsync-go-sdk/`)
- Generated source in `sdk/`

## Workflow

1. Make API changes in `packages/envsync-api/`
2. Regenerate the SDK(s) using the commands above
3. Verify consuming apps still build

Do not modify generated files directly — changes will be overwritten on next generation.
