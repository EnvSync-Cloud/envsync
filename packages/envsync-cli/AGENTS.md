# EnvSync CLI

Go CLI client for the EnvSync platform.

## Stack

- **Language:** Go
- **CLI framework:** `urfave/cli`
- **Entry point:** `cmd/cli/main.go`

## Architecture

```
cmd/cli/main.go          # entry point + command registration
internal/
  actions/               # CLI command handlers
  features/              # use-case orchestration
  services/              # business logic
  repository/            # API client (sdks/envsync-go-sdk — product + manage)
  domain/                # data models
  presentation/          # CLI output formatting (tables, etc.)
  config/                # ~/.envsyncrc.toml config loader
  mappers/               # domain <-> API mapping
  constants/             # shared constants
  logger/                # logging
  utils/                 # helpers
```

**SDK:** use only `github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk`. There is no separate management Go SDK. Manage HTTP paths are under `/api/v1/manage/...` on the same `BackendURL` as the product API (no `:4001` second process).

## Commands

| Command | Description |
|---------|-------------|
| `make build` | Build binary (injects backend URL via ldflags) |
| `make install` | Install binary to `/usr/local/bin` |
| `make dev` | Run in development mode |
| `make watch` | Hot reload with `air` (`.air.toml`) |
| `make lint` | Run `golangci-lint` |
| `make tidy` | Format code + tidy go.mod |

## Config

- User config: `~/.envsyncrc.toml` (auth tokens and preferences)
- Backend URL: compile-time injected via ldflags (`BACKEND_URL` make variable). Override in `~/.envsyncrc.toml`. Default local API is typically `http://localhost:4000` (origin only — no path prefix).

## Logging & telemetry

- Log file: `~/.local/envsync/logs/envsync.log` (macOS/Linux) or `~/envsync/logs/envsync.log` (Windows), JSON, rotated (10 MB, 3 backups, 7 days). There is no console core: stdout/stderr belong to command output (`--json`) and the spinner/TUI.
- Logs carry `trace_id`/`span_id` fields and are exported as OTEL logs via otelzap when telemetry is enabled, so local records and telemetry signals correlate.
- Traces: every command action runs under a `cli/<command path>` span (`internal/features/commands/root.go` `observe`); each use case spans its operation via `telemetry.StartSpan`; each service method spans `svc.<domain>.<method>`; HTTP is auto-instrumented with `otelhttp` via `telemetry.NewInstrumentedTransport` (span name `METHOD /path`, one log record per API call with method/path/status/duration).
- Attribute rule: span attributes and log fields carry identifiers only (ids, names, paths) — never secret values, tokens, key material, or request/response bodies.
- Use-case convention (named `err` result required):

  ```go
  ctx, end := telemetry.StartSpan(ctx, "app.create", trace.WithAttributes(attribute.String("app.name", app.Name)))
  defer end(&err)
  ```

  `end` records failures on the span (exception + error status), logs them (`logger.FromContext(ctx)`), and ends the span. Logging elsewhere: `logger.FromContext(ctx)`.
- Telemetry config: `ENVSYNC_TELEMETRY_URL` (collector base or concrete signal URL), `ENVSYNC_OTEL_SERVICE`, `ENVSYNC_OTEL_DISABLED=true`; fallback `telemetry_url` in `~/.envsyncrc.toml`. Graceful no-op when unset.
- Failures exit non-zero: `FormatError`/`FormatJSONError` return `formatters.RenderedError` (message already displayed); `main` exits 1 without re-printing. `FormatWarning` stays non-fatal.

## Release

GoReleaser config in `.goreleaser.yml`. Release workflow in `.github/workflows/release.yml`.

## Conventions

- All internal packages under `internal/` — not importable externally
- Follow Go standard project layout
- Lint with `golangci-lint run` before committing
