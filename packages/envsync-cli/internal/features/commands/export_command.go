package commands

import (
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/handlers"
	"github.com/urfave/cli/v3"
)

func ExportCommand(handler *handlers.ExportHandler) *cli.Command {
	return &cli.Command{
		Name:   "export",
		Usage:  "Export environment variables and secrets for CI workflows",
		Action: handler.Export,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "app-id",
				Usage: "Application ID to export from",
			},
			&cli.StringFlag{
				Name:  "env-type-id",
				Usage: "Environment type ID to export from",
			},
			&cli.StringFlag{
				Name:  "env-type",
				Usage: "Environment type name to resolve within the application",
			},
			&cli.StringFlag{
				Name:        "config",
				DefaultText: "envsyncrc.toml",
				Usage:       "Path to the project configuration file used for fallback values",
				Value:       "envsyncrc.toml",
			},
			&cli.StringFlag{
				Name:  "format",
				Usage: "Output format: dotenv or json",
				Value: "dotenv",
			},
			&cli.StringFlag{
				Name:  "output",
				Usage: "Optional file path to write the exported content to",
			},
			&cli.StringFlag{
				Name:  "enable-secrets",
				Usage: "Secret export mode: auto, true, false",
				Value: "auto",
			},
			&cli.StringFlag{
				Name:  "is-secret-managed",
				Usage: "Managed secret mode: auto, true, false",
				Value: "auto",
			},
			&cli.StringFlag{
				Name:  "private-key-file",
				Usage: "Path to a PEM private key for self-managed secrets",
			},
		},
	}
}
