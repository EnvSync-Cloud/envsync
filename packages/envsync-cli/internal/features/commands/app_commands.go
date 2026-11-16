package commands

import (
	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/handlers"
)

// AppCommands returns all app-related commands
func AppCommands(handler *handlers.AppHandler) *cli.Command {
	return &cli.Command{
		Name:  "app",
		Usage: "Interact with your applications",
		Commands: []*cli.Command{
			CreateCommand(handler),
			DeleteCommand(handler),
			ListCommand(handler),
		},
	}
}

func CreateCommand(handler *handlers.AppHandler) *cli.Command {
	return &cli.Command{
		Name:   "create",
		Usage:  "Create a new application",
		Action: handler.Create,
		Description: `Create a new application.

Omit --name to be prompted interactively for the application details.

Examples:
  envsync app create --name my-app --description "Customer-facing API"
  envsync app create -n my-app -d "Customer-facing API" --default-types
  envsync app create -n my-app -d "Customer-facing API" --enable-secret
  envsync app create -n my-app -d "Customer-facing API" -m team=core -m owner=platform

Notes:
  --metadata is repeatable and takes key=value pairs.
  --public-key is only used together with --enable-secret.`,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:    "name",
				Usage:   "Application name; omit to be prompted interactively",
				Aliases: []string{"n"},
			},
			&cli.StringFlag{
				Name:    "description",
				Usage:   "Application description",
				Aliases: []string{"d"},
			},
			&cli.StringSliceFlag{
				Name:    "metadata",
				Usage:   "Metadata entry as a key=value pair (repeatable)",
				Aliases: []string{"m"},
			},
			&cli.BoolFlag{
				Name:    "default-types",
				Usage:   "Also create the default PROD and DEV environment types",
				Aliases: []string{"t"},
			},
			&cli.BoolFlag{
				Name:    "enable-secret",
				Usage:   "Enable encryption for secrets in this application",
				Aliases: []string{"s"},
			},
			&cli.StringFlag{
				Name:    "public-key",
				Usage:   "Public key for secret encryption; omit to let EnvSync generate and manage one. Requires --enable-secret",
				Aliases: []string{"p"},
				Value:   "",
			},
		},
	}
}

func DeleteCommand(handler *handlers.AppHandler) *cli.Command {
	return &cli.Command{
		Name:   "delete",
		Usage:  "Delete an application",
		Action: handler.Delete,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "id",
				Usage: "Application ID to delete",
			},
			&cli.StringFlag{
				Name:    "name",
				Usage:   "Application name to delete",
				Aliases: []string{"n"},
			},
		},
	}
}

func ListCommand(handler *handlers.AppHandler) *cli.Command {
	return &cli.Command{
		Name:   "list",
		Usage:  "List all applications",
		Action: handler.List,
	}
}
