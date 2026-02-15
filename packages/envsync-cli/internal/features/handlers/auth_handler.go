package handlers

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/savioxavier/termlink"
	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/auth"
	"github.com/EnvSync-Cloud/envsync-cli/internal/presentation/formatters"
	"github.com/EnvSync-Cloud/envsync-cli/internal/presentation/style"
)

type AuthHandler struct {
	loginUseCase  auth.LoginUseCase
	logoutUseCase auth.LogoutUseCase
	whoamiUseCase auth.WhoamiUseCase
	formatter     *formatters.AuthFormatter
}

func NewAuthHandler(
	loginUseCase auth.LoginUseCase,
	logoutUseCase auth.LogoutUseCase,
	whoamiUseCase auth.WhoamiUseCase,
	formatter *formatters.AuthFormatter,
) *AuthHandler {
	return &AuthHandler{
		loginUseCase:  loginUseCase,
		logoutUseCase: logoutUseCase,
		whoamiUseCase: whoamiUseCase,
		formatter:     formatter,
	}
}

func (h *AuthHandler) Login(ctx context.Context, cmd *cli.Command) error {
	// Execute use case to get credentials
	response, err := h.loginUseCase.Execute(ctx)
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if response.Success {
		if err := h.formatter.FormatSuccess(cmd.Writer, response.Message); err != nil {
		}

		// Display user info if available
		if response.UserInfo != nil {
			return h.formatUserInfo(cmd, response.UserInfo)
		}

	}

	return nil
}

func (h *AuthHandler) Logout(ctx context.Context, cmd *cli.Command) error {
	// Execute use case
	if err := h.logoutUseCase.Execute(ctx); err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	return h.formatter.FormatSuccess(cmd.Writer, "Logout successful! You have been signed out.")
}

func (h *AuthHandler) Whoami(ctx context.Context, cmd *cli.Command) error {
	// Execute use case
	response, err := h.whoamiUseCase.Execute(ctx)
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	return h.formatWhoamiResponse(cmd, response)
}

// Helper methods

func (h *AuthHandler) displayLoginInstructions(cmd *cli.Command, credentials interface{}) error {
	// Print as JSON if requested
	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, map[string]interface{}{
			"credentials": credentials,
			"message":     "Complete authentication using the provided credentials",
		})
	}

	// Type assert to get verification details
	// This assumes credentials has methods GetVerificationUri() and GetUserCode()
	fmt.Println("🔐 Authentication Required")
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	// We'll need to access the credentials fields directly since we don't have the exact type
	// For now, we'll use a generic approach
	if credMap, ok := credentials.(map[string]interface{}); ok {
		if uri, exists := credMap["verification_uri"]; exists {
			fmt.Println(termlink.Link("1. Open this URL in your browser: ", style.LinkStyle.Render(fmt.Sprintf("%v", uri)), true))
		}
		if code, exists := credMap["user_code"]; exists {
			fmt.Printf("2. Enter this verification code: %v\n", code)
		}
	} else {
		// Fallback to JSON output if we can't parse the structure
		jsonData, _ := json.MarshalIndent(credentials, "", "  ")
		fmt.Printf("Login credentials:\n%s\n", string(jsonData))
	}

	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Println()

	return nil
}

// func (h *AuthHandler) openBrowserForLogin(verificationUri string) error {
// 	return browser.OpenURL(verificationUri)
// }

func (h *AuthHandler) formatWhoamiResponse(cmd *cli.Command, response *auth.WhoamiResponse) error {
	if !response.IsLoggedIn {
		return h.formatter.FormatWarning(cmd.Writer, "You are not logged in. Run 'envsync auth login' to authenticate.")
	}

	// Display user information
	if err := h.formatter.FormatSuccess(cmd.Writer, "You are logged in!"); err != nil {
		return err
	}

	if response.UserInfo != nil {
		return h.formatUserInfo(cmd, response.UserInfo)
	}

	return nil
}

func (h *AuthHandler) formatUserInfo(cmd *cli.Command, userInfo interface{}) error {
	// Format user info in a readable way
	fmt.Println("\n👤 User Information:")
	fmt.Println("━━━━━━━━━━━━━━━━━━━━")

	// Format user info in a readable plain text format with emojis
	if user, ok := userInfo.(*domain.UserInfo); ok {
		if user.UserId != "" {
			fmt.Printf("🏷️  UserID: %v\n", user.UserId)
		}
		if user.Email != "" {
			fmt.Printf("📧 Email: %v\n", user.Email)
		}
		if user.Org != "" {
			fmt.Printf("🏢 Organization: %v\n", user.Org)
		}
		if user.Role != "" {
			fmt.Printf("👤 Role: %v\n", user.Role)
		}
	} else {
		// Fallback if userInfo is not the expected type
		return h.formatter.FormatJSON(cmd.Writer, userInfo)
	}
	return nil
}

func (h *AuthHandler) formatUseCaseError(cmd *cli.Command, err error) error {
	// Handle different types of use case errors
	switch e := err.(type) {
	case *auth.AuthError:
		switch e.Code {
		case auth.AuthErrorCodeNotLoggedIn:
			return h.formatter.FormatWarning(cmd.Writer, "Not logged in: "+e.Message)
		case auth.AuthErrorCodeLoginFailed:
			return h.formatter.FormatError(cmd.Writer, "Login failed: "+e.Message)
		case auth.AuthErrorCodeTokenInvalid:
			return h.formatter.FormatError(cmd.Writer, "Token invalid: "+e.Message)
		case auth.AuthErrorCodeTokenExpired:
			return h.formatter.FormatError(cmd.Writer, "Token expired: "+e.Message)
		case auth.AuthErrorCodeTimeout:
			return h.formatter.FormatError(cmd.Writer, "Authentication timeout: "+e.Message)
		case auth.AuthErrorCodeCancelled:
			return h.formatter.FormatWarning(cmd.Writer, "Authentication cancelled: "+e.Message)
		case auth.AuthErrorCodeNetworkError:
			return h.formatter.FormatError(cmd.Writer, "Network error: "+e.Message)
		default:
			return h.formatter.FormatError(cmd.Writer, "Authentication error: "+e.Message)
		}
	default:
		return h.formatter.FormatError(cmd.Writer, "Unexpected error: "+err.Error())
	}
}
