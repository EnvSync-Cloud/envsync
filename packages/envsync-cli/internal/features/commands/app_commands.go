package commands

import (
	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/features/handlers"
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
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:    "name",
				Usage:   "Application name",
				Aliases: []string{"n"},
			},
			&cli.StringFlag{
				Name:    "description",
				Usage:   "Application description",
				Aliases: []string{"d"},
			},
			&cli.StringSliceFlag{
				Name:    "metadata",
				Usage:   "Application metadata in key=value format",
				Aliases: []string{"m"},
			},
			&cli.BoolFlag{
				Name:    "default-types",
				Usage:   "Create PROD and DEV environment by default",
				Aliases: []string{"dt"},
			},
			&cli.BoolFlag{
				Name:    "enable-secret",
				Usage:   "Its a boolean to confirm you want to enable secrets for your application",
				Aliases: []string{"es"},
			},
			&cli.StringFlag{
				Name:    "public-key",
				Usage:   "Public key for the application, used for encryption.(Note: If not provided then a new key will be generated and will be managed by EnvSync)",
				Aliases: []string{"pk"},
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
