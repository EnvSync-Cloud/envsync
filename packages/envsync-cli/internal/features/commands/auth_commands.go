package commands

import (
	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/features/handlers"
)

// AuthCommands returns all auth-related commands
func AuthCommands(handler *handlers.AuthHandler) *cli.Command {
	return &cli.Command{
		Name:  "auth",
		Usage: "Authentication and user management",
		Commands: []*cli.Command{
			LoginCommand(handler),
			LogoutCommand(handler),
			WhoamiCommand(handler),
		},
	}
}

func LoginCommand(handler *handlers.AuthHandler) *cli.Command {
	return &cli.Command{
		Name:   "login",
		Usage:  "Authenticate with EnvSync Cloud",
		Action: handler.Login,
		Description: `Authenticate with EnvSync Cloud using device flow authentication.

This command will:
  1. Generate a device code and verification URL
  2. Open your browser to the verification page
  3. Wait for you to complete authentication
  4. Save the access token to your local configuration

Examples:
  envsync auth login
  envsync auth login --no-browser
  envsync auth login --no-wait --json`,
	}
}

func LogoutCommand(handler *handlers.AuthHandler) *cli.Command {
	return &cli.Command{
		Name:   "logout",
		Usage:  "Sign out and clear authentication token",
		Action: handler.Logout,
		Description: `Sign out from EnvSync Cloud and clear the local authentication token.

This command will:
  1. Clear the access token from local configuration
  2. Remove any cached user information
  3. Reset authentication state

Examples:
  envsync auth logout
  envsync auth logout --force`,
		Flags: []cli.Flag{
			&cli.BoolFlag{
				Name:  "force",
				Usage: "Force logout even if not currently logged in",
				Value: false,
			},
		},
	}
}

func WhoamiCommand(handler *handlers.AuthHandler) *cli.Command {
	return &cli.Command{
		Name:   "whoami",
		Usage:  "Display current user information and authentication status",
		Action: handler.Whoami,
		Description: `Display information about the currently authenticated user.

This command will show:
  - Current authentication status
  - User profile information (name, email, etc.)
  - Token configuration details
  - Session information

Examples:
  envsync auth whoami
  envsync auth whoami --json`,
		Flags: []cli.Flag{
			&cli.BoolFlag{
				Name:  "show-token",
				Usage: "Show the full access token (security risk - use with caution)",
				Value: false,
			},
		},
	}
}
