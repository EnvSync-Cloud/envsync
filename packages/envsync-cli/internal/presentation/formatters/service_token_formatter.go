package formatters

import (
	"fmt"
	"io"
	"text/tabwriter"
	"time"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/style"
)

type ServiceTokenFormatter struct {
	*BaseFormatter
}

func NewServiceTokenFormatter() *ServiceTokenFormatter {
	base := NewBaseFormatter()
	return &ServiceTokenFormatter{
		BaseFormatter: base,
	}
}

func (f *ServiceTokenFormatter) FormatCreateSuccessMessage(writer io.Writer, token *domain.ServiceToken) error {
	successMsg := fmt.Sprintf("✅ Service token '%s' created successfully!\n\n", token.Name)
	successMsg += fmt.Sprintf("📛 Name: %s\n", token.Name)
	successMsg += fmt.Sprintf("🆔 ID: %s\n", token.ID)
	successMsg += fmt.Sprintf("🔑 Token: %s\n", token.Token)
	if token.AppID != "" {
		successMsg += fmt.Sprintf("📱 App ID: %s\n", token.AppID)
	}
	if token.EnvTypeID != "" {
		successMsg += fmt.Sprintf("🌍 Env Type ID: %s\n", token.EnvTypeID)
	}
	if token.Permissions != nil {
		successMsg += fmt.Sprintf("📖 Read: %v\n", token.Permissions.Read)
		successMsg += fmt.Sprintf("✏️  Write: %v\n", token.Permissions.Write)
	}
	successMsg += fmt.Sprintf("📅 Expires At: %s\n", formatTime(token.ExpiresAt))
	successMsg += fmt.Sprintf("🕐 Created At: %s\n", formatTime(token.CreatedAt))

	successMsg = style.Render(style.BoxStyle, successMsg)

	_, err := writer.Write([]byte(successMsg))
	return err
}

func (f *ServiceTokenFormatter) FormatGetSuccessMessage(writer io.Writer, token *domain.ServiceToken) error {
	msg := "🔑 Service Token Details\n\n"
	msg += fmt.Sprintf("📛 Name: %s\n", token.Name)
	msg += fmt.Sprintf("🆔 ID: %s\n", token.ID)
	if token.AppID != "" {
		msg += fmt.Sprintf("📱 App ID: %s\n", token.AppID)
	}
	if token.EnvTypeID != "" {
		msg += fmt.Sprintf("🌍 Env Type ID: %s\n", token.EnvTypeID)
	}
	if token.Permissions != nil {
		msg += fmt.Sprintf("📖 Read: %v\n", token.Permissions.Read)
		msg += fmt.Sprintf("✏️  Write: %v\n", token.Permissions.Write)
	}
	msg += fmt.Sprintf("📅 Expires At: %s\n", formatTime(token.ExpiresAt))
	if token.LastUsedAt != nil {
		msg += fmt.Sprintf("🕐 Last Used At: %s\n", formatTime(*token.LastUsedAt))
	}
	msg += fmt.Sprintf("🕐 Created At: %s\n", formatTime(token.CreatedAt))

	msg = style.Render(style.BoxStyle, msg)

	_, err := writer.Write([]byte(msg))
	return err
}

func (f *ServiceTokenFormatter) FormatListTable(writer io.Writer, tokens []domain.ServiceToken) error {
	w := tabwriter.NewWriter(writer, 0, 0, 2, ' ', 0)

	fmt.Fprintln(w, "ID\tNAME\tAPP ID\tENV TYPE ID\tREAD\tWRITE\tEXPIRES AT\tCREATED AT")
	fmt.Fprintln(w, "--\t----\t------\t----------\t----\t-----\t----------\t----------")

	for _, token := range tokens {
		appID := "-"
		if token.AppID != "" {
			appID = token.AppID
		}
		envTypeID := "-"
		if token.EnvTypeID != "" {
			envTypeID = token.EnvTypeID
		}

		readPerm := "-"
		writePerm := "-"
		if token.Permissions != nil {
			readPerm = fmt.Sprintf("%v", token.Permissions.Read)
			writePerm = fmt.Sprintf("%v", token.Permissions.Write)
		}

		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
			token.ID,
			token.Name,
			appID,
			envTypeID,
			readPerm,
			writePerm,
			formatTime(token.ExpiresAt),
			formatTime(token.CreatedAt),
		)
	}

	return w.Flush()
}

// formatTime renders timestamps in RFC3339, the shape the API returns and the
// CLI printed before the domain switch. Zero times mean "unknown".
func formatTime(t time.Time) string {
	if t.IsZero() {
		return "-"
	}
	return t.Format(time.RFC3339)
}

func (f *ServiceTokenFormatter) FormatDeleteSuccessMessage(writer io.Writer, id string) error {
	successMsg := fmt.Sprintf("✅ Service token deleted successfully! (ID: %s)\n", id)
	successMsg = style.Render(style.BoxStyle, successMsg)

	_, err := writer.Write([]byte(successMsg))
	return err
}
