package auth

import (
	"context"
	"fmt"
	"strings"

	"github.com/pkg/browser"
	"github.com/savioxavier/termlink"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/style"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type loginUseCase struct {
	authService services.AuthService
}

func NewLoginUseCase() LoginUseCase {
	service := services.NewAuthService()
	return &loginUseCase{
		authService: service,
	}
}

func (uc *loginUseCase) Execute(ctx context.Context) (*LoginResponse, error) {
	return uc.ExecuteWithOptions(ctx, false, false)
}

func (uc *loginUseCase) ExecuteWithOptions(ctx context.Context, noBrowser bool, noWait bool) (*LoginResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "auth.login")
	defer span.End()

	userInfo, err := uc.checkCurrentLoginStatus(ctx)
	if err == nil && userInfo != nil {
		return &LoginResponse{
			Success:  true,
			Message:  "Already logged in",
			UserInfo: userInfo,
		}, nil
	}

	credentials, err := uc.authService.InitiateLogin(ctx)
	if err != nil {
		return nil, NewLoginFailedError("failed to initiate login process", err)
	}

	if err := uc.displayLoginInstructions(credentials); err != nil {
	}

	if noWait {
		return &LoginResponse{
			Success: true,
			Message: "Device code generated. Complete authentication in your browser, then run 'envsync auth whoami' to verify.",
		}, nil
	}

	if !noBrowser {
		if err := uc.openBrowserForLogin(credentials.GetVerificationUri()); err != nil {
		}
	}

	token, err := uc.authService.PollForToken(ctx, credentials)
	if err != nil {
		return nil, uc.handlePollingError(err)
	}

	if err := uc.authService.SaveToken(token); err != nil {
		return nil, NewServiceError("failed to save authentication token", err)
	}

	return &LoginResponse{
		Success:  true,
		Message:  "Login successful! You are now authenticated.",
		UserInfo: userInfo,
	}, nil
}

// checkCurrentLoginStatus checks if the user is already logged in by trying to get their info
func (uc *loginUseCase) checkCurrentLoginStatus(ctx context.Context) (*domain.UserInfo, error) {
	// Try to get current user info to check if already logged in
	userInfo, err := uc.authService.Whoami(ctx)
	if err != nil {
		// If we can't get user info, assume not logged in
		return nil, err
	}
	return userInfo, nil
}

// handlePollingError processes errors that occur during the polling phase of authentication
func (uc *loginUseCase) handlePollingError(err error) error {
	errMsg := err.Error()

	// Check for specific error types and provide better error messages
	if strings.Contains(errMsg, "timeout") {
		return NewTimeoutError("authentication timed out - please try again", err)
	}

	if strings.Contains(errMsg, "cancelled") || strings.Contains(errMsg, "canceled") {
		return NewCancelledError("authentication was cancelled", err)
	}

	if strings.Contains(errMsg, "device_code") {
		return NewTokenInvalidError("device code expired or invalid - please try again", err)
	}

	if strings.Contains(errMsg, "network") || strings.Contains(errMsg, "connection") {
		return NewNetworkError("network error during authentication", err)
	}

	if strings.Contains(errMsg, "server") || strings.Contains(errMsg, "5") {
		return NewServiceError("authentication service error", err)
	}

	// Default to login failed error
	return NewLoginFailedError("authentication failed", err)
}

// displayLoginInstructions shows the user what they need to do to authenticate
func (uc *loginUseCase) displayLoginInstructions(credentials any) error {
	// Type assert to our domain model
	creds, ok := credentials.(*domain.LoginCredentials)
	if !ok {
		return fmt.Errorf("invalid credentials type")
	}

	fmt.Println("🔐 Authentication Required")
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Println(termlink.Link("1. Open this URL in your browser: ", style.LinkStyle.Render(creds.GetVerificationUri()), true))
	fmt.Printf("2. Enter this verification code: %s\n", creds.GetUserCode())
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Println()

	return nil
}

// openBrowserForLogin attempts to open the verification URL in the user's default browser
func (us *loginUseCase) openBrowserForLogin(verificationUri string) error {
	return browser.OpenURL(verificationUri)
}
