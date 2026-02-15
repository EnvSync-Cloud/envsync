package commands

import (
	"github.com/EnvSync-Cloud/envsync-cli/internal/features/handlers"
	"github.com/urfave/cli/v3"
)

func InitCommand(handler *handlers.InitHandler) *cli.Command {
	return &cli.Command{
		Name:   "init",
		Usage:  "Initialize the EnvSync CLI configuration",
		Action: handler.Init,
	}
}
