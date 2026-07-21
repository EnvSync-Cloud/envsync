package formatters

import (
	"fmt"
	"io"
	"text/tabwriter"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

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

func (f *ServiceTokenFormatter) FormatCreateSuccessMessage(writer io.Writer, token *sdk.CreateServiceTokenResponse) error {
	successMsg := fmt.Sprintf("✅ Service token '%s' created successfully!\n\n", token.Name)
	successMsg += fmt.Sprintf("📛 Name: %s\n", token.Name)
	successMsg += fmt.Sprintf("🆔 ID: %s\n", token.Id)
	successMsg += fmt.Sprintf("🔑 Token: %s\n", token.Token)
	if token.AppId != nil {
		successMsg += fmt.Sprintf("📱 App ID: %s\n", *token.AppId)
	}
	if token.EnvTypeId != nil {
		successMsg += fmt.Sprintf("🌍 Env Type ID: %s\n", *token.EnvTypeId)
	}
	if token.Permissions != nil {
		successMsg += fmt.Sprintf("📖 Read: %v\n", token.Permissions.Read)
		successMsg += fmt.Sprintf("✏️  Write: %v\n", token.Permissions.Write)
	}
	successMsg += fmt.Sprintf("📅 Expires At: %s\n", token.ExpiresAt)
	successMsg += fmt.Sprintf("🕐 Created At: %s\n", token.CreatedAt)

	successMsg = style.BoxStyle.Render(successMsg)

	_, err := writer.Write([]byte(successMsg))
	return err
}

func (f *ServiceTokenFormatter) FormatGetSuccessMessage(writer io.Writer, token *sdk.ServiceTokenResponse) error {
	msg := "🔑 Service Token Details\n\n"
	msg += fmt.Sprintf("📛 Name: %s\n", token.Name)
	msg += fmt.Sprintf("🆔 ID: %s\n", token.Id)
	if token.AppId != nil {
		msg += fmt.Sprintf("📱 App ID: %s\n", *token.AppId)
	}
	if token.EnvTypeId != nil {
		msg += fmt.Sprintf("🌍 Env Type ID: %s\n", *token.EnvTypeId)
	}
	if token.Permissions != nil {
		msg += fmt.Sprintf("📖 Read: %v\n", token.Permissions.Read)
		msg += fmt.Sprintf("✏️  Write: %v\n", token.Permissions.Write)
	}
	msg += fmt.Sprintf("📅 Expires At: %s\n", token.ExpiresAt)
	if token.LastUsedAt != nil {
		msg += fmt.Sprintf("🕐 Last Used At: %s\n", *token.LastUsedAt)
	}
	msg += fmt.Sprintf("🕐 Created At: %s\n", token.CreatedAt)

	msg = style.BoxStyle.Render(msg)

	_, err := writer.Write([]byte(msg))
	return err
}

func (f *ServiceTokenFormatter) FormatListTable(writer io.Writer, tokens sdk.ServiceTokensResponse) error {
	w := tabwriter.NewWriter(writer, 0, 0, 2, ' ', 0)

	fmt.Fprintln(w, "ID\tNAME\tAPP ID\tENV TYPE ID\tREAD\tWRITE\tEXPIRES AT\tCREATED AT")
	fmt.Fprintln(w, "--\t----\t------\t----------\t----\t-----\t----------\t----------")

	for _, token := range tokens {
		appID := "-"
		if token.AppId != nil {
			appID = *token.AppId
		}
		envTypeID := "-"
		if token.EnvTypeId != nil {
			envTypeID = *token.EnvTypeId
		}

		readPerm := "false"
		writePerm := "false"
		if token.Permissions != nil {
			readPerm = fmt.Sprintf("%v", token.Permissions.Read)
			writePerm = fmt.Sprintf("%v", token.Permissions.Write)
		}

		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
			token.Id,
			token.Name,
			appID,
			envTypeID,
			readPerm,
			writePerm,
			token.ExpiresAt,
			token.CreatedAt,
		)
	}

	return w.Flush()
}

func (f *ServiceTokenFormatter) FormatDeleteSuccessMessage(writer io.Writer, id string) error {
	successMsg := fmt.Sprintf("✅ Service token deleted successfully! (ID: %s)\n", id)
	successMsg = style.BoxStyle.Render(successMsg)

	_, err := writer.Write([]byte(successMsg))
	return err
}
