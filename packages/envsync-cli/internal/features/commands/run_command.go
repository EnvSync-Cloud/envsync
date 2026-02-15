package commands

import (
	"github.com/EnvSync-Cloud/envsync-cli/internal/features/handlers"
	"github.com/urfave/cli/v3"
)

func RunCommand(handler *handlers.RunHandler) *cli.Command {
	return &cli.Command{
		Name:   "run",
		Usage:  "Run application with environment variables",
		Action: handler.Run,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "command",
				Usage:    "Command to run the application",
				Aliases:  []string{"c"},
				Required: true,
			},
			&cli.StringFlag{
				Name:     "private-key",
				Usage:    "Path to the private key for managed secrets",
				Aliases:  []string{"pk"},
				Required: false,
			},
		},
	}
}
