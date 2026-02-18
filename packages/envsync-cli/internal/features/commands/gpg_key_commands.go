package commands

import (
	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/features/handlers"
)

func GpgKeyCommands(handler *handlers.GpgKeyHandler) *cli.Command {
	return &cli.Command{
		Name:  "gpg",
		Usage: "Manage GPG keys for signing and verification",
		Commands: []*cli.Command{
			gpgListCommand(handler),
			gpgGenerateCommand(handler),
			gpgSignCommand(handler),
			gpgVerifyCommand(handler),
			gpgExportCommand(handler),
			gpgRevokeCommand(handler),
			gpgDeleteCommand(handler),
		},
	}
}

func gpgListCommand(handler *handlers.GpgKeyHandler) *cli.Command {
	return &cli.Command{
		Name:   "list",
		Usage:  "List organization GPG keys",
		Action: handler.List,
	}
}

func gpgGenerateCommand(handler *handlers.GpgKeyHandler) *cli.Command {
	return &cli.Command{
		Name:   "generate",
		Usage:  "Generate a new GPG key pair",
		Action: handler.Generate,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "name",
				Usage:    "Key owner name",
				Required: true,
			},
			&cli.StringFlag{
				Name:     "email",
				Usage:    "Key owner email",
				Required: true,
			},
			&cli.StringFlag{
				Name:  "algorithm",
				Usage: "Key algorithm (ecc-curve25519, rsa, ecc-p256, ecc-p384)",
				Value: "ecc-curve25519",
			},
			&cli.IntFlag{
				Name:  "key-size",
				Usage: "Key size in bits (for RSA algorithm)",
			},
			&cli.IntFlag{
				Name:  "expires-in-days",
				Usage: "Key expiration in days",
			},
			&cli.BoolFlag{
				Name:  "default",
				Usage: "Set as default signing key",
			},
		},
	}
}

func gpgSignCommand(handler *handlers.GpgKeyHandler) *cli.Command {
	return &cli.Command{
		Name:   "sign",
		Usage:  "Sign a file or data using a GPG key",
		Action: handler.Sign,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "key-id",
				Usage:    "GPG key ID to sign with",
				Required: true,
			},
			&cli.StringFlag{
				Name:  "file",
				Usage: "Path to file to sign (or pipe via stdin)",
			},
			&cli.StringFlag{
				Name:  "mode",
				Usage: "Signing mode (binary, text, clearsign)",
				Value: "binary",
			},
			&cli.BoolFlag{
				Name:  "detached",
				Usage: "Create detached signature",
				Value: true,
			},
			&cli.StringFlag{
				Name:  "output",
				Usage: "Output file path (default: stdout)",
			},
		},
	}
}

func gpgVerifyCommand(handler *handlers.GpgKeyHandler) *cli.Command {
	return &cli.Command{
		Name:   "verify",
		Usage:  "Verify a GPG signature",
		Action: handler.Verify,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "file",
				Usage:    "Path to the signed data file",
				Required: true,
			},
			&cli.StringFlag{
				Name:     "signature",
				Usage:    "Path to the signature file",
				Required: true,
			},
			&cli.StringFlag{
				Name:  "key-id",
				Usage: "GPG key ID (optional, tries all org keys if omitted)",
			},
		},
	}
}

func gpgExportCommand(handler *handlers.GpgKeyHandler) *cli.Command {
	return &cli.Command{
		Name:   "export",
		Usage:  "Export a GPG public key (armored PEM)",
		Action: handler.Export,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "key-id",
				Usage:    "GPG key ID to export",
				Required: true,
			},
			&cli.StringFlag{
				Name:  "output",
				Usage: "Output file path (default: stdout)",
			},
		},
	}
}

func gpgRevokeCommand(handler *handlers.GpgKeyHandler) *cli.Command {
	return &cli.Command{
		Name:   "revoke",
		Usage:  "Revoke a GPG key",
		Action: handler.Revoke,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "key-id",
				Usage:    "GPG key ID to revoke",
				Required: true,
			},
			&cli.StringFlag{
				Name:  "reason",
				Usage: "Revocation reason",
			},
		},
	}
}

func gpgDeleteCommand(handler *handlers.GpgKeyHandler) *cli.Command {
	return &cli.Command{
		Name:   "delete",
		Usage:  "Delete a GPG key",
		Action: handler.Delete,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "key-id",
				Usage:    "GPG key ID to delete",
				Required: true,
			},
		},
	}
}
