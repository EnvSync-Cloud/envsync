# EnvSync CLI

Go CLI in this monorepo at `packages/envsync-cli`. It talks to one API origin through `sdks/envsync-go-sdk`. Product routes are `/api/...`. Enterprise manage routes are `/api/v1/manage/...` on that same origin.

Sign-in is Atrium, through `envsync auth login`.

## Install

Release binaries are published from this monorepo. From a clone:

```bash
cd packages/envsync-cli
make build BACKEND_URL=http://api.lvh.me:4000
sudo cp bin/envsync /usr/local/bin/envsync
envsync --help
```

`make build` defaults `BACKEND_URL` to `http://localhost:8600`. Local Compose serves the API at `http://api.lvh.me:4000`, so pass that URL when you build for this repo. You can also set `ENVSYNC_API_URL` at runtime.

Go 1.26 or newer. See [AGENTS.md](./AGENTS.md) for the internal layout.

## Commands

| Command | What it does |
|---------|----------------|
| `envsync auth login` | Device-flow sign-in. `--no-browser`, `--no-wait` |
| `envsync auth whoami` | Print the signed-in identity |
| `envsync auth logout` | Clear the local session |
| `envsync init` | Write `envsyncrc.toml`. `--app-id` / `-a`, `--env-type-id` / `-e` |
| `envsync pull` | Pull the environment named in `envsyncrc.toml` |
| `envsync push` | Push local values for that same config |
| `envsync export` | CI export. `--app`, `--env`, `--format dotenv\|json` |
| `envsync run --command "..."` | Run a command with the synced environment. Alias `-c` |
| `envsync app` | `create`, `list`, `delete` |
| `envsync env` | `list`, `switch`, `delete` (`environment` is the long name) |
| `envsync config` | `get`, `set`, `reset` |
| `envsync request` | Change requests: list, get, approve, reject, cancel |
| `envsync team` | Teams and membership |
| `envsync access` | Project grants |
| `envsync service-token` | Service tokens |
| `envsync cert` | Organization CA and certificates |
| `envsync gpg` | GPG keys |
| `envsync rotation` | Rotation jobs |
| `envsync dynamic-secret` | Dynamic secret engines |
| `envsync gen-pem` | Generate a managed-secret key pair |

Global flag: `--json` / `-j`.

`envsync pull` and `envsync push` do not take `--env`. Point `envsyncrc.toml` at the environment with `envsync init` or `envsync env switch`, then pull or push. `envsync export` is the command that takes `--app` and `--env`.

```bash
envsync auth login
envsync init --app-id "<app-id>" --env-type-id "<env-type-id>"
envsync pull
envsync push
envsync export --app my-app --env production --format dotenv
envsync run --command "bun run start"
```

## Config

Project file, written by `envsync init`:

```toml
app_id = "<app-id>"
env_type_id = "<env-type-id>"
```

User config is `~/.envsyncrc.toml` (tokens and preferences).

For CI, set `API_KEY`. That skips interactive login. `ENVSYNC_API_URL` overrides the API origin baked in at build time.

## License

The CLI is part of the public monorepo. See the root [LICENSE](../../LICENSE) and [EDITIONING.md](../../EDITIONING.md).
