package commands

import (
	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/handlers"
)

func SamlCommands(handler *handlers.SamlHandler) *cli.Command {
	return &cli.Command{
		Name:  "saml",
		Usage: "Manage SAML SSO providers",
		Commands: []*cli.Command{
			samlCreateCommand(handler),
			samlListCommand(handler),
			samlGetCommand(handler),
			samlUpdateCommand(handler),
			samlDeleteCommand(handler),
			samlMetadataCommand(handler),
			samlSsoCommand(handler),
		},
	}
}

func samlCreateCommand(handler *handlers.SamlHandler) *cli.Command {
	return &cli.Command{
		Name:   "create",
		Usage:  "Register a new SAML identity provider",
		Action: handler.Create,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "name",
				Usage:    "Human-readable name for the provider",
				Aliases:  []string{"n"},
				Required: true,
			},
			&cli.StringFlag{
				Name:     "provider-type",
				Usage:    "SAML IdP type (okta, onelogin, azure-ad, google-workspace, duo, rippling, oracle, ping-identity)",
				Required: true,
			},
			&cli.StringFlag{
				Name:     "entity-id",
				Usage:    "SAML entity ID (issuer) from the IdP metadata",
				Required: true,
			},
			&cli.StringFlag{
				Name:     "sso-url",
				Usage:    "IdP SSO login URL",
				Required: true,
			},
			&cli.StringFlag{
				Name:     "certificate",
				Usage:    "IdP X.509 certificate (PEM format) for signature validation",
				Required: true,
			},
		},
	}
}

func samlListCommand(handler *handlers.SamlHandler) *cli.Command {
	return &cli.Command{
		Name:   "list",
		Usage:  "List all SAML providers",
		Action: handler.List,
	}
}

func samlGetCommand(handler *handlers.SamlHandler) *cli.Command {
	return &cli.Command{
		Name:   "get",
		Usage:  "Get details of a specific SAML provider",
		Action: handler.Get,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "id",
				Usage:    "SAML provider ID",
				Required: true,
			},
		},
	}
}

func samlUpdateCommand(handler *handlers.SamlHandler) *cli.Command {
	return &cli.Command{
		Name:   "update",
		Usage:  "Update an existing SAML provider",
		Action: handler.Update,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "id",
				Usage:    "SAML provider ID",
				Required: true,
			},
			&cli.StringFlag{
				Name:  "name",
				Usage: "Updated provider name",
			},
			&cli.StringFlag{
				Name:  "entity-id",
				Usage: "Updated entity ID",
			},
			&cli.StringFlag{
				Name:  "sso-url",
				Usage: "Updated SSO URL",
			},
			&cli.StringFlag{
				Name:  "certificate",
				Usage: "Updated X.509 certificate (PEM format)",
			},
			&cli.BoolFlag{
				Name:  "enabled",
				Usage: "Enable or disable the provider",
			},
		},
	}
}

func samlDeleteCommand(handler *handlers.SamlHandler) *cli.Command {
	return &cli.Command{
		Name:   "delete",
		Usage:  "Delete a SAML provider",
		Action: handler.Delete,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "id",
				Usage:    "SAML provider ID",
				Required: true,
			},
		},
	}
}

func samlMetadataCommand(handler *handlers.SamlHandler) *cli.Command {
	return &cli.Command{
		Name:   "metadata",
		Usage:  "Retrieve SAML Service Provider metadata XML",
		Action: handler.Metadata,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "id",
				Usage:    "SAML provider ID",
				Required: true,
			},
		},
	}
}

func samlSsoCommand(handler *handlers.SamlHandler) *cli.Command {
	return &cli.Command{
		Name:   "sso",
		Usage:  "Initiate SP-initiated SAML SSO flow",
		Action: handler.Sso,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:     "provider-id",
				Usage:    "SAML provider ID to initiate SSO with",
				Required: true,
			},
		},
	}
}
