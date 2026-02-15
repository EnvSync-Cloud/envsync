package commands

import (
	"github.com/EnvSync-Cloud/envsync-cli/internal/features/handlers"
	"github.com/urfave/cli/v3"
)

func GenereatePrivateKeyCommand(handler *handlers.GenPEMKeyHandler) *cli.Command {
	return &cli.Command{
		Name:    "gen-pem",
		Aliases: []string{"gpem"},
		Usage:   "Generate a new pair of key for managing your secrets",
		Action:  handler.GeneratePEMKey,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "output",
				Usage:    "Output file for the generated private key",
				Aliases:  []string{"o"},
				Required: false,
			},
		},
	}
}
