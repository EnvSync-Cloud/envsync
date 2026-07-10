package formatters

import (
	"fmt"
	"io"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/style"
)

type OidcFormatter struct {
	*BaseFormatter
}

func NewOidcFormatter() *OidcFormatter {
	return &OidcFormatter{BaseFormatter: NewBaseFormatter()}
}

func (f *OidcFormatter) FormatCreateSuccess(writer io.Writer, p domain.OidcProvider) error {
	msg := fmt.Sprintf("✅ OIDC provider '%s' created successfully!\n\n", p.ProviderType)
	msg += fmt.Sprintf("🆔 ID: %s\n", p.ID)
	msg += fmt.Sprintf("🏷️  Type: %s\n", p.ProviderType)
	msg += fmt.Sprintf("🔗 Issuer URL: %s\n", p.IssuerURL)
	msg += fmt.Sprintf("🎯 Audience: %s\n", p.Audience)
	msg += fmt.Sprintf("✅ Enabled: %t\n", p.Enabled)
	if len(p.AllowedSubjects) > 0 {
		msg += fmt.Sprintf("👤 Allowed Subjects: %s\n", strings.Join(p.AllowedSubjects, ", "))
	}
	msg = style.BoxStyle.Render(msg)
	_, err := writer.Write([]byte(msg))
	return err
}

func (f *OidcFormatter) FormatList(writer io.Writer, providers []domain.OidcProvider) error {
	if len(providers) == 0 {
		_, err := writer.Write([]byte("No OIDC providers found.\n"))
		return err
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("%-36s %-18s %-40s %-20s %-8s\n", "ID", "TYPE", "ISSUER URL", "AUDIENCE", "ENABLED"))
	sb.WriteString(strings.Repeat("-", 126) + "\n")

	for _, p := range providers {
		sb.WriteString(fmt.Sprintf("%-36s %-18s %-40s %-20s %-8t\n",
			p.ID, p.ProviderType, truncateOidc(p.IssuerURL, 38), truncateOidc(p.Audience, 18), p.Enabled))
	}

	_, err := writer.Write([]byte(sb.String()))
	return err
}

func (f *OidcFormatter) FormatDetail(writer io.Writer, p domain.OidcProvider) error {
	msg := fmt.Sprintf("🆔 ID: %s\n", p.ID)
	msg += fmt.Sprintf("🏢 Org ID: %s\n", p.OrgID)
	msg += fmt.Sprintf("🏷️  Type: %s\n", p.ProviderType)
	msg += fmt.Sprintf("🔗 Issuer URL: %s\n", p.IssuerURL)
	msg += fmt.Sprintf("🎯 Audience: %s\n", p.Audience)
	msg += fmt.Sprintf("✅ Enabled: %t\n", p.Enabled)
	if len(p.AllowedSubjects) > 0 {
		msg += fmt.Sprintf("👤 Allowed Subjects: %s\n", strings.Join(p.AllowedSubjects, ", "))
	} else {
		msg += "👤 Allowed Subjects: (all)\n"
	}
	if p.MachineUserID != "" {
		msg += fmt.Sprintf("🤖 Machine User ID: %s\n", p.MachineUserID)
	}
	msg += fmt.Sprintf("🕐 Created: %s\n", p.CreatedAt)
	msg += fmt.Sprintf("🕐 Updated: %s\n", p.UpdatedAt)

	msg = style.BoxStyle.Render(msg)
	_, err := writer.Write([]byte(msg))
	return err
}

func (f *OidcFormatter) FormatDeleteSuccess(writer io.Writer, id string) error {
	return f.FormatSuccess(writer, fmt.Sprintf("OIDC provider '%s' deleted successfully", id))
}

func truncateOidc(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
