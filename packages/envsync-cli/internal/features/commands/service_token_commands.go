package commands

import (
	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/handlers"
)

func ServiceTokenCommands(handler *handlers.ServiceTokenHandler) *cli.Command {
	return &cli.Command{
		Name:    "service-token",
		Aliases: []string{"st"},
		Usage:   "Manage service tokens",
		Commands: []*cli.Command{
			serviceTokenCreateCommand(handler),
			serviceTokenListCommand(handler),
			serviceTokenGetCommand(handler),
			serviceTokenDeleteCommand(handler),
		},
	}
}

func serviceTokenCreateCommand(handler *handlers.ServiceTokenHandler) *cli.Command {
	return &cli.Command{
		Name:   "create",
		Usage:  "Create a new service token",
		Action: handler.Create,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "name",
				Usage:    "Service token name",
				Aliases:  []string{"n"},
				Required: true,
			},
			&cli.StringFlag{
				Name:  "app-id",
				Usage: "Application ID to scope the token to",
			},
			&cli.StringFlag{
				Name:  "env-type-id",
				Usage: "Environment type ID to scope the token to",
			},
			&cli.BoolFlag{
				Name:  "read",
				Usage: "Grant read permissions",
			},
			&cli.BoolFlag{
				Name:  "write",
				Usage: "Grant write permissions",
			},
			&cli.IntFlag{
				Name:  "expires-in-days",
				Usage: "Number of days until the token expires",
			},
		},
	}
}

func serviceTokenListCommand(handler *handlers.ServiceTokenHandler) *cli.Command {
	return &cli.Command{
		Name:   "list",
		Usage:  "List all service tokens",
		Action: handler.List,
	}
}

func serviceTokenGetCommand(handler *handlers.ServiceTokenHandler) *cli.Command {
	return &cli.Command{
		Name:   "get",
		Usage:  "Get a service token by ID",
		Action: handler.Get,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "id",
				Usage:    "Service token ID",
				Required: true,
			},
		},
	}
}

func serviceTokenDeleteCommand(handler *handlers.ServiceTokenHandler) *cli.Command {
	return &cli.Command{
		Name:   "delete",
		Usage:  "Delete a service token",
		Action: handler.Delete,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "id",
				Usage:    "Service token ID",
				Required: true,
			},
		},
	}
}
