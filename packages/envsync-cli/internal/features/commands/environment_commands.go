package commands

import (
	"github.com/EnvSync-Cloud/envsync-cli/internal/features/handlers"
	"github.com/urfave/cli/v3"
)

func EnvironmentCommands(handlers *handlers.EnvironmentHandler) *cli.Command {
	return &cli.Command{
		Name:    "environment",
		Aliases: []string{"env"},
		Usage:   "Manage environments for applications",
		Commands: []*cli.Command{
			SwitchEnvironmentCommand(handlers),
			GetAllEnvironmentsCommand(handlers),
			DeleteEnvironmentCommand(handlers),
		},
	}
}

func SwitchEnvironmentCommand(handlers *handlers.EnvironmentHandler) *cli.Command {
	return &cli.Command{
		Name:    "switch",
		Aliases: []string{"sw"},
		Usage:   "Switch to a different environment",
		Action:  handlers.SwitchEnvironment,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "app-id",
				Usage:    "ID of the application to switch environment for",
				Required: false,
			},
			&cli.StringFlag{
				Name:     "env-id",
				Usage:    "ID of the environment to switch to",
				Required: false,
			},
		},
	}
}

func GetAllEnvironmentsCommand(handlers *handlers.EnvironmentHandler) *cli.Command {
	return &cli.Command{
		Name:    "list",
		Aliases: []string{"ls"},
		Usage:   "List all environments for an application",
		Action:  handlers.GetAllEnvironments,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "app-id",
				Usage:    "ID of the application to list environments for",
				Required: true,
			},
		},
	}
}

func DeleteEnvironmentCommand(handlers *handlers.EnvironmentHandler) *cli.Command {
	return &cli.Command{
		Name:    "delete",
		Aliases: []string{"del"},
		Usage:   "Delete an environment",
		Action:  handlers.DeleteEnvironment,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "id",
				Usage:    "ID of the environment to delete",
				Required: true,
			},
		},
	}
}
