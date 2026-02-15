package commands

import (
	"github.com/EnvSync-Cloud/envsync-cli/internal/features/handlers"
	"github.com/urfave/cli/v3"
)

func PullCommand(handler *handlers.SyncHandler) *cli.Command {
	return &cli.Command{
		Name:   "pull",
		Usage:  "Pull environment variables from the remote server",
		Action: handler.Pull,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:        "config",
				DefaultText: "envsyncrc.toml",
				Required:    false,
				Usage:       "Path to the configuration file",
				Value:       "envsyncrc.toml",
			},
		},
	}
}

func PushCommand(handler *handlers.SyncHandler) *cli.Command {
	return &cli.Command{
		Name:   "push",
		Usage:  "Push environment variables to the remote server",
		Action: handler.Push,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:        "config",
				DefaultText: "envsyncrc.toml",
				Required:    false,
				Usage:       "Path to the configuration file",
				Value:       "envsyncrc.toml",
			},
		},
	}
}
