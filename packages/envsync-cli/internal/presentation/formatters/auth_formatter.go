package formatters

import (
	"fmt"
	"io"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
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

// FormatSuccess formats success messages
func (f *AuthFormatter) FormatSuccess(writer io.Writer, message string) error {
	output := fmt.Sprintf("✅ %s\n", message)
	_, err := writer.Write([]byte(output))
	return err
}

// FormatError formats error messages. The returned RenderedError marks the
// command as failed without re-printing the message.
func (f *AuthFormatter) FormatError(writer io.Writer, message string) error {
	output := fmt.Sprintf("❌ %s\n", message)
	if _, err := writer.Write([]byte(output)); err != nil {
		return err
	}
	return NewRenderedError(message)
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
