package commands

import (
	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/handlers"
)

func DynamicSecretCommands(handler *handlers.DynamicSecretHandler) *cli.Command {
	return &cli.Command{
		Name:    "dynamic-secret",
		Usage:   "Manage dynamic secret engines and leases",
		Aliases: []string{"ds"},
		Commands: []*cli.Command{
			// Engine commands
			dsCreateEngineCommand(handler),
			dsListEnginesCommand(handler),
			dsGetEngineCommand(handler),
			dsUpdateEngineCommand(handler),
			dsDeleteEngineCommand(handler),
			// Lease commands
			dsCreateLeaseCommand(handler),
			dsListLeasesCommand(handler),
			dsGetLeaseCommand(handler),
			dsRevokeLeaseCommand(handler),
			dsCleanupCommand(handler),
		},
	}
}

// Engine commands

func dsCreateEngineCommand(handler *handlers.DynamicSecretHandler) *cli.Command {
	return &cli.Command{
		Name:   "create-engine",
		Usage:  "Create a new dynamic secret engine",
		Action: handler.CreateEngine,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:    "name",
				Usage:   "Engine name",
				Aliases: []string{"n"},
			},
			&cli.StringFlag{
				Name:  "engine",
				Usage: "Engine type (postgres|mysql|aws-iam|azure-sp)",
			},
			&cli.StringFlag{
				Name:  "config",
				Usage: "Engine configuration as JSON string",
			},
		},
	}
}

func dsListEnginesCommand(handler *handlers.DynamicSecretHandler) *cli.Command {
	return &cli.Command{
		Name:   "list-engines",
		Usage:  "List all dynamic secret engines",
		Action: handler.ListEngines,
	}
}

func dsGetEngineCommand(handler *handlers.DynamicSecretHandler) *cli.Command {
	return &cli.Command{
		Name:   "get-engine",
		Usage:  "Get a dynamic secret engine by ID",
		Action: handler.GetEngine,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "id",
				Usage: "Engine ID (required)",
			},
		},
	}
}

func dsUpdateEngineCommand(handler *handlers.DynamicSecretHandler) *cli.Command {
	return &cli.Command{
		Name:   "update-engine",
		Usage:  "Update a dynamic secret engine",
		Action: handler.UpdateEngine,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "id",
				Usage: "Engine ID (required)",
			},
			&cli.StringFlag{
				Name:    "name",
				Usage:   "New engine name",
				Aliases: []string{"n"},
			},
			&cli.StringFlag{
				Name:  "config",
				Usage: "Updated configuration as JSON string",
			},
			&cli.BoolFlag{
				Name:  "enabled",
				Usage: "Enable or disable the engine",
			},
		},
	}
}

func dsDeleteEngineCommand(handler *handlers.DynamicSecretHandler) *cli.Command {
	return &cli.Command{
		Name:   "delete-engine",
		Usage:  "Delete a dynamic secret engine (must have no active leases)",
		Action: handler.DeleteEngine,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "id",
				Usage: "Engine ID (required)",
			},
		},
	}
}

// Lease commands

func dsCreateLeaseCommand(handler *handlers.DynamicSecretHandler) *cli.Command {
	return &cli.Command{
		Name:   "create-lease",
		Usage:  "Create a new dynamic secret lease (generate short-lived credentials)",
		Action: handler.CreateLease,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "engine-id",
				Usage: "Engine ID to create the lease on (required)",
			},
			&cli.StringFlag{
				Name:  "ttl",
				Usage: "Time-to-live duration (e.g., '1h', '24h', '7d')",
			},
		},
	}
}

func dsListLeasesCommand(handler *handlers.DynamicSecretHandler) *cli.Command {
	return &cli.Command{
		Name:   "list-leases",
		Usage:  "List all leases for a dynamic secret engine",
		Action: handler.ListLeases,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "engine-id",
				Usage: "Engine ID to list leases for (required)",
			},
		},
	}
}

func dsGetLeaseCommand(handler *handlers.DynamicSecretHandler) *cli.Command {
	return &cli.Command{
		Name:   "get-lease",
		Usage:  "Get a dynamic secret lease by ID",
		Action: handler.GetLease,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "id",
				Usage: "Lease ID (required)",
			},
		},
	}
}

func dsRevokeLeaseCommand(handler *handlers.DynamicSecretHandler) *cli.Command {
	return &cli.Command{
		Name:   "revoke-lease",
		Usage:  "Revoke a dynamic secret lease and its credentials",
		Action: handler.RevokeLease,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "id",
				Usage: "Lease ID (required)",
			},
		},
	}
}

func dsCleanupCommand(handler *handlers.DynamicSecretHandler) *cli.Command {
	return &cli.Command{
		Name:   "cleanup",
		Usage:  "Mark all expired leases as revoked (admin operation)",
		Action: handler.Cleanup,
	}
}
