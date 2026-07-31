# envsync-kernel

**License:** MIT

Shared primitives used by `envsync-api` (core process) and `envsync-enterprise` / `envsync-management-api` (enterprise process).

## Scope (Phase 5)

- HTTP/domain error types (`AppError`, `ForbiddenError`, …)
- `ApiModule` / `ApiSurface` contracts for modular route registration

## Non-goals

- Database drivers, full env schema, domain services (see future `envsync-core-domain`)
- Enterprise feature implementations (live in `envsync-enterprise` + still-migrating paths in `envsync-api`)
