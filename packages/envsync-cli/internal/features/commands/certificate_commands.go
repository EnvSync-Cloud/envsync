package commands

import (
	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/features/handlers"
)

func CertificateCommands(handler *handlers.CertificateHandler) *cli.Command {
	return &cli.Command{
		Name:    "cert",
		Usage:   "Manage PKI certificates",
		Commands: []*cli.Command{
			certCACommands(handler),
			certIssueCommand(handler),
			certListCommand(handler),
			certRevokeCommand(handler),
			certOCSPCommand(handler),
			certCRLCommand(handler),
			certRootCACommand(handler),
		},
	}
}

func certCACommands(handler *handlers.CertificateHandler) *cli.Command {
	return &cli.Command{
		Name:  "ca",
		Usage: "Organization CA management",
		Commands: []*cli.Command{
			{
				Name:   "init",
				Usage:  "Initialize organization CA",
				Action: handler.InitCA,
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "org-name",
						Usage:    "Organization name",
						Required: true,
					},
					&cli.StringFlag{
						Name:  "description",
						Usage: "CA description",
					},
				},
			},
			{
				Name:   "status",
				Usage:  "Show organization CA status",
				Action: handler.CAStatus,
			},
		},
	}
}

func certIssueCommand(handler *handlers.CertificateHandler) *cli.Command {
	return &cli.Command{
		Name:   "issue",
		Usage:  "Issue a member/service certificate",
		Action: handler.IssueCert,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "email",
				Usage:    "Member or service email (e.g., user@example.com or svc@internal)",
				Required: true,
			},
			&cli.StringFlag{
				Name:     "role",
				Usage:    "Certificate role (e.g., developer, gateway, api)",
				Required: true,
			},
			&cli.StringFlag{
				Name:  "description",
				Usage: "Certificate description",
			},
			&cli.StringFlag{
				Name:  "metadata",
				Usage: "Key-value metadata (format: key=value,key=value)",
			},
			&cli.StringFlag{
				Name:  "output-cert",
				Usage: "Save certificate PEM to file",
			},
			&cli.StringFlag{
				Name:  "output-key",
				Usage: "Save private key PEM to file",
			},
		},
	}
}

func certListCommand(handler *handlers.CertificateHandler) *cli.Command {
	return &cli.Command{
		Name:   "list",
		Usage:  "List all certificates",
		Action: handler.ListCerts,
	}
}

func certRevokeCommand(handler *handlers.CertificateHandler) *cli.Command {
	return &cli.Command{
		Name:   "revoke",
		Usage:  "Revoke a certificate",
		Action: handler.RevokeCert,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "serial",
				Usage:    "Certificate serial number (hex)",
				Required: true,
			},
			&cli.IntFlag{
				Name:  "reason",
				Usage: "Revocation reason code (RFC 5280: 0=unspecified, 1=keyCompromise, 5=cessationOfOperation)",
				Value: 0,
			},
		},
	}
}

func certOCSPCommand(handler *handlers.CertificateHandler) *cli.Command {
	return &cli.Command{
		Name:   "ocsp",
		Usage:  "Check OCSP status of a certificate",
		Action: handler.CheckOCSP,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "serial",
				Usage:    "Certificate serial number (hex)",
				Required: true,
			},
		},
	}
}

func certCRLCommand(handler *handlers.CertificateHandler) *cli.Command {
	return &cli.Command{
		Name:   "crl",
		Usage:  "Download Certificate Revocation List",
		Action: handler.GetCRL,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "output",
				Usage: "Output file path (default: stdout)",
			},
		},
	}
}

func certRootCACommand(handler *handlers.CertificateHandler) *cli.Command {
	return &cli.Command{
		Name:   "root-ca",
		Usage:  "Get root CA certificate",
		Action: handler.GetRootCA,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "output",
				Usage: "Output file path (default: stdout)",
			},
		},
	}
}
