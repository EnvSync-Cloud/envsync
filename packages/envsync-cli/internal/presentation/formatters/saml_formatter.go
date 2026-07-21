package formatters

import (
	"fmt"
	"io"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/style"
)

type SamlFormatter struct {
	*BaseFormatter
}

func NewSamlFormatter() *SamlFormatter {
	return &SamlFormatter{BaseFormatter: NewBaseFormatter()}
}

func (f *SamlFormatter) FormatCreateSuccess(writer io.Writer, p domain.SamlProvider) error {
	msg := fmt.Sprintf("✅ SAML provider '%s' created successfully!\n\n", p.Name)
	msg += fmt.Sprintf("🆔 ID: %s\n", p.ID)
	msg += fmt.Sprintf("🏷️  Type: %s\n", p.ProviderType)
	msg += fmt.Sprintf("📛 Name: %s\n", p.Name)
	msg += fmt.Sprintf("🔗 Entity ID: %s\n", p.EntityID)
	msg += fmt.Sprintf("🌐 SSO URL: %s\n", p.SsoURL)
	msg += fmt.Sprintf("✅ Enabled: %t\n", p.Enabled)
	msg = style.BoxStyle.Render(msg)
	_, err := writer.Write([]byte(msg))
	return err
}

func (f *SamlFormatter) FormatList(writer io.Writer, providers []domain.SamlProvider) error {
	if len(providers) == 0 {
		_, err := writer.Write([]byte("No SAML providers found.\n"))
		return err
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("%-36s %-18s %-25s %-40s %-8s\n", "ID", "TYPE", "NAME", "ENTITY ID", "ENABLED"))
	sb.WriteString(strings.Repeat("-", 131) + "\n")

	for _, p := range providers {
		sb.WriteString(fmt.Sprintf("%-36s %-18s %-25s %-40s %-8t\n",
			p.ID, p.ProviderType, truncateSaml(p.Name, 23), truncateSaml(p.EntityID, 38), p.Enabled))
	}

	_, err := writer.Write([]byte(sb.String()))
	return err
}

func (f *SamlFormatter) FormatDetail(writer io.Writer, p domain.SamlProvider) error {
	msg := fmt.Sprintf("🆔 ID: %s\n", p.ID)
	msg += fmt.Sprintf("🏢 Org ID: %s\n", p.OrgID)
	msg += fmt.Sprintf("🏷️  Type: %s\n", p.ProviderType)
	msg += fmt.Sprintf("📛 Name: %s\n", p.Name)
	msg += fmt.Sprintf("🔗 Entity ID: %s\n", p.EntityID)
	msg += fmt.Sprintf("🌐 SSO URL: %s\n", p.SsoURL)
	msg += fmt.Sprintf("📜 Certificate: %s\n", truncateSaml(p.Certificate, 60))
	msg += fmt.Sprintf("✅ Enabled: %t\n", p.Enabled)
	msg += fmt.Sprintf("🕐 Created: %s\n", p.CreatedAt)
	msg += fmt.Sprintf("🕐 Updated: %s\n", p.UpdatedAt)

	msg = style.BoxStyle.Render(msg)
	_, err := writer.Write([]byte(msg))
	return err
}

func (f *SamlFormatter) FormatDeleteSuccess(writer io.Writer, id string) error {
	return f.FormatSuccess(writer, fmt.Sprintf("SAML provider '%s' deleted successfully", id))
}

func (f *SamlFormatter) FormatMetadataSuccess(writer io.Writer, id string) error {
	return f.FormatSuccess(writer, fmt.Sprintf("SAML metadata retrieved for provider '%s'", id))
}

func (f *SamlFormatter) FormatSsoResult(writer io.Writer, result domain.SamlSsoResult) error {
	msg := "🔐 SAML SSO initiated successfully!\n\n"
	msg += fmt.Sprintf("🌐 Redirect URL: %s\n", result.RedirectURL)
	msg += fmt.Sprintf("🆔 Request ID: %s\n", result.RequestID)
	msg += "\nOpen the redirect URL in your browser to complete authentication.\n"

	msg = style.BoxStyle.Render(msg)
	_, err := writer.Write([]byte(msg))
	return err
}

func truncateSaml(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
