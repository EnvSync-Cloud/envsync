package commands

import (
	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/handlers"
)

func RotationCommands(handler *handlers.RotationHandler) *cli.Command {
	return &cli.Command{
		Name:  "rotation",
		Usage: "Manage secret rotation policies",
		Commands: []*cli.Command{
			rotationCreateCommand(handler),
			rotationListCommand(handler),
			rotationGetCommand(handler),
			rotationUpdateCommand(handler),
			rotationDeleteCommand(handler),
			rotationTriggerCommand(handler),
			rotationStatesCommand(handler),
			rotationRevokeExpiredCommand(handler),
		},
	}
}

func rotationCreateCommand(handler *handlers.RotationHandler) *cli.Command {
	return &cli.Command{
		Name:   "create",
		Usage:  "Create a new rotation policy",
		Action: handler.Create,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:    "name",
				Usage:   "Variable key name for the rotation policy",
				Aliases: []string{"n"},
			},
			&cli.StringFlag{
				Name:  "engine",
				Usage: "Engine type (postgres|mysql|aws-iam|azure-sp|gcp-service-account|cloudflare-pages|sendgrid|twilio)",
			},
			&cli.StringFlag{
				Name:  "secret-id",
				Usage: "Application ID for the secret to rotate",
			},
			&cli.StringFlag{
				Name:  "schedule",
				Usage: "Cron expression for rotation schedule",
			},
			&cli.StringFlag{
				Name:  "config",
				Usage: "Connection config as JSON string",
			},
		},
	}
}

func rotationListCommand(handler *handlers.RotationHandler) *cli.Command {
	return &cli.Command{
		Name:   "list",
		Usage:  "List all rotation policies",
		Action: handler.List,
	}
}

func rotationGetCommand(handler *handlers.RotationHandler) *cli.Command {
	return &cli.Command{
		Name:   "get",
		Usage:  "Get a rotation policy by ID",
		Action: handler.Get,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "id",
				Usage: "Rotation policy ID",
			},
		},
	}
}

func rotationUpdateCommand(handler *handlers.RotationHandler) *cli.Command {
	return &cli.Command{
		Name:   "update",
		Usage:  "Update a rotation policy",
		Action: handler.Update,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "id",
				Usage: "Rotation policy ID (required)",
			},
			&cli.StringFlag{
				Name:    "name",
				Usage:   "New variable key name",
				Aliases: []string{"n"},
			},
			&cli.StringFlag{
				Name:  "schedule",
				Usage: "New cron expression for rotation schedule",
			},
			&cli.BoolFlag{
				Name:  "enabled",
				Usage: "Enable or disable the rotation policy",
			},
			&cli.StringFlag{
				Name:  "config",
				Usage: "Updated connection config as JSON string",
			},
		},
	}
}

func rotationDeleteCommand(handler *handlers.RotationHandler) *cli.Command {
	return &cli.Command{
		Name:   "delete",
		Usage:  "Delete a rotation policy",
		Action: handler.Delete,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "id",
				Usage: "Rotation policy ID (required)",
			},
		},
	}
}

func rotationTriggerCommand(handler *handlers.RotationHandler) *cli.Command {
	return &cli.Command{
		Name:   "trigger",
		Usage:  "Manually trigger a secret rotation",
		Action: handler.Trigger,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "id",
				Usage: "Rotation policy ID (required)",
			},
		},
	}
}

func rotationStatesCommand(handler *handlers.RotationHandler) *cli.Command {
	return &cli.Command{
		Name:   "states",
		Usage:  "Get rotation state history for a policy",
		Action: handler.States,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "id",
				Usage: "Rotation policy ID (required)",
			},
		},
	}
}

func rotationRevokeExpiredCommand(handler *handlers.RotationHandler) *cli.Command {
	return &cli.Command{
		Name:   "revoke-expired",
		Usage:  "Revoke expired credentials across all rotation policies",
		Action: handler.RevokeExpired,
	}
}
