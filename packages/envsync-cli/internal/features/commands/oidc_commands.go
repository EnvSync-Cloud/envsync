package commands

import (
	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/handlers"
)

func OidcCommands(handler *handlers.OidcHandler) *cli.Command {
	return &cli.Command{
		Name:  "oidc",
		Usage: "Manage OIDC providers for machine auth",
		Commands: []*cli.Command{
			oidcCreateCommand(handler),
			oidcListCommand(handler),
			oidcGetCommand(handler),
			oidcUpdateCommand(handler),
			oidcDeleteCommand(handler),
		},
	}
}

func oidcCreateCommand(handler *handlers.OidcHandler) *cli.Command {
	return &cli.Command{
		Name:   "create",
		Usage:  "Register a new OIDC provider",
		Action: handler.Create,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "name",
				Usage:    "OIDC provider type (github_actions, gitlab_ci, kubernetes, generic)",
				Aliases:  []string{"n"},
				Required: true,
			},
			&cli.StringFlag{
				Name:     "issuer-url",
				Usage:    "OIDC issuer URL",
				Required: true,
			},
			&cli.StringFlag{
				Name:     "audience",
				Usage:    "Expected audience claim value",
				Required: true,
			},
			&cli.StringFlag{
				Name:  "allowed-subjects",
				Usage: "Comma-separated subject patterns to allow (glob matching)",
			},
		},
	}
}

func oidcListCommand(handler *handlers.OidcHandler) *cli.Command {
	return &cli.Command{
		Name:   "list",
		Usage:  "List all OIDC providers",
		Action: handler.List,
	}
}

func oidcGetCommand(handler *handlers.OidcHandler) *cli.Command {
	return &cli.Command{
		Name:   "get",
		Usage:  "Get details of a specific OIDC provider",
		Action: handler.Get,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "id",
				Usage:    "OIDC provider ID",
				Required: true,
			},
		},
	}
}

func oidcUpdateCommand(handler *handlers.OidcHandler) *cli.Command {
	return &cli.Command{
		Name:   "update",
		Usage:  "Update an existing OIDC provider",
		Action: handler.Update,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "id",
				Usage:    "OIDC provider ID",
				Required: true,
			},
			&cli.StringFlag{
				Name:  "audience",
				Usage: "Updated audience claim value",
			},
			&cli.BoolFlag{
				Name:  "enabled",
				Usage: "Enable or disable the provider",
			},
			&cli.StringFlag{
				Name:  "allowed-subjects",
				Usage: "Comma-separated subject patterns to allow",
			},
		},
	}
}

func oidcDeleteCommand(handler *handlers.OidcHandler) *cli.Command {
	return &cli.Command{
		Name:   "delete",
		Usage:  "Delete an OIDC provider",
		Action: handler.Delete,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "id",
				Usage:    "OIDC provider ID",
				Required: true,
			},
		},
	}
}
