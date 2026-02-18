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
  repository/            # API client (HTTP calls to envsync-api)
  domain/                # data models
  presentation/          # CLI output formatting (tables, etc.)
  config/                # ~/.envsyncrc.toml config loader
  mappers/               # domain <-> API mapping
  constants/             # shared constants
  logger/                # logging
  utils/                 # helpers
```

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
- Backend URL: compile-time injected via ldflags (`BACKEND_URL` make variable, defaults to `http://localhost:8600/api`). Can be overridden in config

## Release

GoReleaser config in `.goreleaser.yml`. Release workflow in `.github/workflows/release.yml`.

## Conventions

- All internal packages under `internal/` — not importable externally
- Follow Go standard project layout
- Lint with `golangci-lint run` before committing
