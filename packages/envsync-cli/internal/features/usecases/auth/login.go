package auth

import (
	"context"
	"fmt"
	"strings"

	"github.com/pkg/browser"
	"github.com/savioxavier/termlink"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/presentation/style"
	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
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
	// Check if user is already logged in
	userInfo, err := uc.checkCurrentLoginStatus()
	if err == nil && userInfo != nil {
		// If we can get user info, assume already logged in
		return &LoginResponse{
			Success:  true,
			Message:  "Already logged in",
			UserInfo: userInfo,
		}, nil
	}

	// Step 1: Initiate the login process
	credentials, err := uc.authService.InitiateLogin()
	if err != nil {
		return nil, NewLoginFailedError("failed to initiate login process", err)
	}

	// Print login instructions
	if err := uc.displayLoginInstructions(credentials); err != nil {
	}

	if err := uc.openBrowserForLogin(credentials.GetVerificationUri()); err != nil {
	}

	// Step 2: Poll for token completion
	token, err := uc.authService.PollForToken(credentials)
	if err != nil {
		return nil, uc.handlePollingError(err)
	}

	// Step 3: Save the token
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
func (uc *loginUseCase) checkCurrentLoginStatus() (*domain.UserInfo, error) {
	// Try to get current user info to check if already logged in
	userInfo, err := uc.authService.Whoami()
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
