package commands

import (
	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/handlers"
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
			gpgRotateCommand(handler),
			gpgExtendExpiryCommand(handler),
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
				Name:  "name",
				Usage: "Key owner name (asked interactively when omitted)",
			},
			&cli.StringFlag{
				Name:  "email",
				Usage: "Key owner email (asked interactively when omitted)",
			},
			&cli.StringFlag{
				Name:  "algorithm",
				Usage: "Key algorithm (ECC Curve25519, ECC P-256, ECC P-384, RSA 4096)",
				Value: "ecc-curve25519",
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

func gpgRotateCommand(handler *handlers.GpgKeyHandler) *cli.Command {
	return &cli.Command{
		Name:   "rotate",
		Usage:  "Rotate a GPG key and optionally make the new key default",
		Action: handler.Rotate,
		Flags: []cli.Flag{
			&cli.StringFlag{Name: "key-id", Usage: "GPG key ID to rotate", Required: true},
			&cli.StringFlag{Name: "name", Usage: "Override key owner name"},
			&cli.StringFlag{Name: "email", Usage: "Override key owner email"},
			&cli.StringFlag{Name: "algorithm", Usage: "Override algorithm"},
			&cli.IntFlag{Name: "key-size", Usage: "Override key size for RSA"},
			&cli.IntFlag{Name: "expires-in-days", Usage: "New key expiry in days", Value: 365},
			&cli.BoolFlag{Name: "revoke-previous", Usage: "Revoke the previous key after rotation", Value: false},
			&cli.BoolFlag{Name: "set-new-default", Usage: "Set the new key as default", Value: true},
		},
	}
}

func gpgExtendExpiryCommand(handler *handlers.GpgKeyHandler) *cli.Command {
	return &cli.Command{
		Name:   "extend-expiry",
		Usage:  "Extend the expiry of a non-revoked GPG key",
		Action: handler.ExtendExpiry,
		Flags: []cli.Flag{
			&cli.StringFlag{Name: "key-id", Usage: "GPG key ID", Required: true},
			&cli.IntFlag{Name: "expires-in-days", Usage: "Additional validity window in days", Required: true},
		},
	}
}
