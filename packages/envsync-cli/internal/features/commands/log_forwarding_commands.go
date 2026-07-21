package commands

import (
	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/handlers"
)

// LogForwardingCommands returns all log-forwarding-related commands
func LogForwardingCommands(handler *handlers.LogForwardingHandler) *cli.Command {
	return &cli.Command{
		Name:    "log-forwarding",
		Aliases: []string{"lf"},
		Usage:   "Manage log forwarding configs",
		Commands: []*cli.Command{
			logForwardingCreateCommand(handler),
			logForwardingListCommand(handler),
			logForwardingGetCommand(handler),
			logForwardingDeleteCommand(handler),
		},
	}
}

func logForwardingCreateCommand(handler *handlers.LogForwardingHandler) *cli.Command {
	return &cli.Command{
		Name:   "create",
		Usage:  "Create a new log forwarding config",
		Action: handler.Create,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "name",
				Usage:    "Config name",
				Aliases:  []string{"n"},
				Required: true,
			},
			&cli.StringFlag{
				Name:     "target",
				Usage:    "Log forwarding target (datadog|splunk|sumo-logic)",
				Aliases:  []string{"t"},
				Required: true,
			},
			&cli.StringFlag{
				Name:     "endpoint-url",
				Usage:    "Endpoint URL for the log forwarding target",
				Aliases:  []string{"eu"},
				Required: true,
			},
			&cli.StringFlag{
				Name:     "api-key",
				Usage:    "API key for the log forwarding target",
				Aliases:  []string{"ak"},
				Required: true,
			},
			&cli.BoolFlag{
				Name:    "enabled",
				Usage:   "Enable the log forwarding config",
				Aliases: []string{"e"},
				Value:   true,
			},
		},
	}
}

func logForwardingListCommand(handler *handlers.LogForwardingHandler) *cli.Command {
	return &cli.Command{
		Name:   "list",
		Usage:  "List all log forwarding configs",
		Action: handler.List,
	}
}

func logForwardingGetCommand(handler *handlers.LogForwardingHandler) *cli.Command {
	return &cli.Command{
		Name:   "get",
		Usage:  "Get a specific log forwarding config",
		Action: handler.Get,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "id",
				Usage:    "Log forwarding config ID",
				Required: true,
			},
		},
	}
}

func logForwardingDeleteCommand(handler *handlers.LogForwardingHandler) *cli.Command {
	return &cli.Command{
		Name:   "delete",
		Usage:  "Delete a log forwarding config",
		Action: handler.Delete,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "id",
				Usage:    "Log forwarding config ID",
				Required: true,
			},
		},
	}
}
