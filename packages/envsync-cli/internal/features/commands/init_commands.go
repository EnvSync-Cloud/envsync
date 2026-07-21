package commands

import (
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/handlers"
	"github.com/urfave/cli/v3"
)

func InitCommand(handler *handlers.InitHandler) *cli.Command {
	return &cli.Command{
		Name:   "init",
		Usage:  "Initialize the EnvSync CLI configuration",
		Action: handler.Init,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:    "app-id",
				Usage:   "Application ID to initialize with",
				Aliases: []string{"a"},
			},
			&cli.StringFlag{
				Name:    "env-type-id",
				Usage:   "Environment type ID to initialize with",
				Aliases: []string{"e"},
			},
		},
	}
}
