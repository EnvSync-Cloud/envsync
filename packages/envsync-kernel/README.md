# envsync-kernel

**License:** MIT

Shared primitives used by `envsync-api` and `envsync-enterprise`.

## Scope

- HTTP/domain error types (`AppError`, `ForbiddenError`, …)
- `ApiModule` / `ApiSurface` / `ModuleRegistry` / `mountModules` for modular route registration
- Core vs management module bags; product mounts manage bag at `/api/v1/manage`

## Non-goals

- Database drivers, full env schema, domain services
- Enterprise feature implementations (live in `envsync-enterprise`)
