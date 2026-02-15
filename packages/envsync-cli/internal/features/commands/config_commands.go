package commands

import (
	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/features/handlers"
)

// ConfigCommands returns all config-related commands
func ConfigCommands(handler *handlers.ConfigHandler) *cli.Command {
	return &cli.Command{
		Name:  "config",
		Usage: "Manage configuration settings",
		Commands: []*cli.Command{
			Set(handler),
			Get(handler),
			Reset(handler),
		},
	}
}

func Set(handler *handlers.ConfigHandler) *cli.Command {
	return &cli.Command{
		Name:      "set",
		Usage:     "Set configuration values",
		Action:    handler.Set,
		ArgsUsage: "key=value [key2=value2 ...]",
		Description: `Set one or more configuration values.

Examples:
  envsync config set backend_url=https://api.envsync.cloud

Supported keys:
  - backend_url: Backend API URL`,
	}
}

func Get(handler *handlers.ConfigHandler) *cli.Command {
	return &cli.Command{
		Name:      "get",
		Usage:     "Get configuration values",
		Action:    handler.Get,
		ArgsUsage: "[key1] [key2] ...",
		Description: `Get configuration values. If no keys are specified, all configuration is shown.

Examples:
  envsync config get
  envsync config get backend_url

Supported keys:
  - backend_url: Backend API URL`,
	}
}

func Reset(handler *handlers.ConfigHandler) *cli.Command {
	return &cli.Command{
		Name:      "reset",
		Aliases:   []string{"r"},
		Usage:     "Reset configuration values",
		Action:    handler.Reset,
		ArgsUsage: "[key1] [key2] ...",
		Description: `Reset configuration values to defaults. If no keys are specified, all configuration is reset.

Examples:
  envsync config reset
  envsync config reset backend_url
`,
	}
}
