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
			rotationListCommand(handler),
			rotationGetCommand(handler),
			rotationTriggerCommand(handler),
			rotationStatesCommand(handler),
			rotationRevokeExpiredCommand(handler),
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
