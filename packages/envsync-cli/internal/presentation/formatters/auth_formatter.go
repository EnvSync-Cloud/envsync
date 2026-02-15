package formatters

import (
	"fmt"
	"io"
	"strings"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
)

type AuthFormatter struct {
	*BaseFormatter
}

func NewAuthFormatter() *AuthFormatter {
	base := NewBaseFormatter()
	return &AuthFormatter{
		BaseFormatter: base,
	}
}

// FormatUserInfo formats user information in a readable format
func (f *AuthFormatter) FormatUserInfo(writer io.Writer, userInfo *domain.UserInfo) error {
	if userInfo == nil {
		_, err := writer.Write([]byte("❌ No user information available\n"))
		return err
	}

	var output strings.Builder
	output.WriteString("👤 User Information:\n")
	output.WriteString("━━━━━━━━━━━━━━━━━━━━\n")

	if userInfo.UserId != "" {
		output.WriteString(fmt.Sprintf("🆔 User ID: %s\n", userInfo.UserId))
	}

	if userInfo.Email != "" {
		output.WriteString(fmt.Sprintf("📧 Email: %s\n", userInfo.Email))
	}

	if userInfo.Org != "" {
		output.WriteString(fmt.Sprintf("🏢 Organization: %s\n", userInfo.Org))
	}

	if userInfo.Role != "" {
		output.WriteString(fmt.Sprintf("👤 Role: %s\n", userInfo.Role))
	}

	_, err := writer.Write([]byte(output.String()))
	return err
}

// FormatLoginCredentials formats login credentials for display
func (f *AuthFormatter) FormatLoginCredentials(writer io.Writer, credentials *domain.LoginCredentials) error {
	if credentials == nil {
		_, err := writer.Write([]byte("❌ No login credentials available\n"))
		return err
	}

	var output strings.Builder
	output.WriteString("🔐 Authentication Required\n")
	output.WriteString("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
	output.WriteString(fmt.Sprintf("1. Open this URL in your browser: %s\n", credentials.GetVerificationUri()))
	output.WriteString(fmt.Sprintf("2. Enter this verification code: %s\n", credentials.GetUserCode()))
	output.WriteString("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
	output.WriteString("\n")

	_, err := writer.Write([]byte(output.String()))
	return err
}

// FormatLoginStatus formats the current login status
func (f *AuthFormatter) FormatLoginStatus(writer io.Writer, isLoggedIn bool, userInfo *domain.UserInfo) error {
	if !isLoggedIn {
		output := "❌ You are not logged in\n💡 Run 'envsync login' to authenticate\n"
		_, err := writer.Write([]byte(output))
		return err
	}

	output := "✅ You are logged in!\n"
	if _, err := writer.Write([]byte(output)); err != nil {
		return err
	}

	if userInfo != nil {
		return f.FormatUserInfo(writer, userInfo)
	}

	return nil
}

// FormatAuthConfig formats authentication configuration
func (f *AuthFormatter) FormatAuthConfig(writer io.Writer, hasToken bool, backendURL, tokenMasked string) error {
	var output strings.Builder
	output.WriteString("🔧 Authentication Configuration:\n")
	output.WriteString("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

	// Access token status
	if hasToken {
		output.WriteString("🔑 Access Token: ✅ Set")
		if tokenMasked != "" {
			output.WriteString(fmt.Sprintf(" (%s)", tokenMasked))
		}
		output.WriteString("\n")
	} else {
		output.WriteString("🔑 Access Token: ❌ Not set\n")
	}

	// Backend URL
	if backendURL != "" {
		output.WriteString(fmt.Sprintf("🌐 Backend URL: %s\n", backendURL))
	} else {
		output.WriteString("🌐 Backend URL: ❌ Not set\n")
	}

	_, err := writer.Write([]byte(output.String()))
	return err
}

// FormatTokenInfo formats access token information
func (f *AuthFormatter) FormatTokenInfo(writer io.Writer, token *domain.AccessToken, masked bool) error {
	if token == nil {
		_, err := writer.Write([]byte("❌ No access token available\n"))
		return err
	}

	var output strings.Builder
	output.WriteString("🔑 Access Token Information:\n")
	output.WriteString("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

	// Token value (masked or full)
	tokenValue := token.Token
	if masked {
		tokenValue = f.maskToken(tokenValue)
	}
	output.WriteString(fmt.Sprintf("Token: %s\n", tokenValue))

	// Token type
	if token.TokenType != "" {
		output.WriteString(fmt.Sprintf("Type: %s\n", token.TokenType))
	}

	// Expiry information
	if !token.ExpiresAt.IsZero() {
		output.WriteString(fmt.Sprintf("Expires at: %s\n", token.ExpiresAt.Format("2006-01-02 15:04:05")))
	}

	// Refresh token
	if token.RefreshToken != "" {
		refreshMasked := f.maskToken(token.RefreshToken)
		output.WriteString(fmt.Sprintf("Refresh Token: %s\n", refreshMasked))
	}

	_, err := writer.Write([]byte(output.String()))
	return err
}

// FormatLoginInstructions formats detailed login instructions
func (f *AuthFormatter) FormatLoginInstructions(writer io.Writer, step string, instructions []string) error {
	var output strings.Builder
	output.WriteString(fmt.Sprintf("📋 %s:\n", step))
	output.WriteString("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

	for i, instruction := range instructions {
		output.WriteString(fmt.Sprintf("%d. %s\n", i+1, instruction))
	}

	output.WriteString("\n")

	_, err := writer.Write([]byte(output.String()))
	return err
}

// Helper methods

func (f *AuthFormatter) maskToken(token string) string {
	if len(token) <= 8 {
		return strings.Repeat("*", len(token))
	}

	// Show first 4 and last 4 characters
	prefix := token[:4]
	suffix := token[len(token)-4:]
	middle := strings.Repeat("*", len(token)-8)

	return prefix + middle + suffix
}

// FormatSuccess formats success messages
func (f *AuthFormatter) FormatSuccess(writer io.Writer, message string) error {
	output := fmt.Sprintf("✅ %s\n", message)
	_, err := writer.Write([]byte(output))
	return err
}

// FormatError formats error messages
func (f *AuthFormatter) FormatError(writer io.Writer, message string) error {
	output := fmt.Sprintf("❌ %s\n", message)
	_, err := writer.Write([]byte(output))
	return err
}

// FormatWarning formats warning messages
func (f *AuthFormatter) FormatWarning(writer io.Writer, message string) error {
	output := fmt.Sprintf("⚠️  %s\n", message)
	_, err := writer.Write([]byte(output))
	return err
}

// FormatInfo formats info messages
func (f *AuthFormatter) FormatInfo(writer io.Writer, message string) error {
	output := fmt.Sprintf("ℹ️  %s\n", message)
	_, err := writer.Write([]byte(output))
	return err
}

// FormatProgress formats progress messages
func (f *AuthFormatter) FormatProgress(writer io.Writer, message string) error {
	output := fmt.Sprintf("⏳ %s\n", message)
	_, err := writer.Write([]byte(output))
	return err
}

// FormatCompact formats auth status in compact format
func (f *AuthFormatter) FormatCompact(writer io.Writer, isLoggedIn bool, userEmail string) error {
	var status string
	if isLoggedIn && userEmail != "" {
		status = fmt.Sprintf("✅ Logged in as %s", userEmail)
	} else if isLoggedIn {
		status = "✅ Logged in"
	} else {
		status = "❌ Not logged in"
	}

	_, err := writer.Write([]byte(status + "\n"))
	return err
}

// FormatSessionInfo formats session information
func (f *AuthFormatter) FormatSessionInfo(writer io.Writer, sessionData map[string]interface{}) error {
	if len(sessionData) == 0 {
		_, err := writer.Write([]byte("📊 No session information available\n"))
		return err
	}

	var output strings.Builder
	output.WriteString("📊 Session Information:\n")
	output.WriteString("━━━━━━━━━━━━━━━━━━━━━━━━\n")

	for key, value := range sessionData {
		output.WriteString(fmt.Sprintf("• %s: %v\n", key, value))
	}

	_, err := writer.Write([]byte(output.String()))
	return err
}
