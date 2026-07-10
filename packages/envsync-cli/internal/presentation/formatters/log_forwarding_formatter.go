package formatters

import (
	"fmt"
	"io"
	"text/tabwriter"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"
)

type LogForwardingFormatter struct {
	*BaseFormatter
}

func NewLogForwardingFormatter() *LogForwardingFormatter {
	return &LogForwardingFormatter{
		BaseFormatter: NewBaseFormatter(),
	}
}

func (f *LogForwardingFormatter) FormatCreateSuccess(writer io.Writer, config *sdk.LogForwardingResponse) error {
	msg := fmt.Sprintf("✅ Log forwarding config '%s' created successfully!\n\n", config.GetName())
	msg += fmt.Sprintf("🆔 ID: %s\n", config.GetId())
	msg += fmt.Sprintf("📛 Name: %s\n", config.GetName())
	msg += fmt.Sprintf("📤 Provider: %s\n", config.GetProviderType())
	msg += fmt.Sprintf("🔛 Enabled: %v\n", config.GetEnabled())
	msg += fmt.Sprintf("📅 Created: %s\n", config.GetCreatedAt())

	_, err := writer.Write([]byte(msg))
	return err
}

func (f *LogForwardingFormatter) FormatListTable(writer io.Writer, configs sdk.LogForwardingsResponse) error {
	w := tabwriter.NewWriter(writer, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tNAME\tPROVIDER\tENABLED\tCREATED AT")
	fmt.Fprintln(w, "--\t----\t--------\t-------\t----------")

	for _, config := range configs {
		fmt.Fprintf(w, "%s\t%s\t%s\t%v\t%s\n",
			config.GetId(),
			config.GetName(),
			config.GetProviderType(),
			config.GetEnabled(),
			config.GetCreatedAt(),
		)
	}

	return w.Flush()
}

func (f *LogForwardingFormatter) FormatGetDetail(writer io.Writer, config *sdk.LogForwardingResponse) error {
	msg := fmt.Sprintf("📛 Name: %s\n", config.GetName())
	msg += fmt.Sprintf("🆔 ID: %s\n", config.GetId())
	msg += fmt.Sprintf("🏢 Org ID: %s\n", config.GetOrgId())
	msg += fmt.Sprintf("📤 Provider: %s\n", config.GetProviderType())
	msg += fmt.Sprintf("🔛 Enabled: %v\n", config.GetEnabled())
	msg += fmt.Sprintf("📅 Created: %s\n", config.GetCreatedAt())
	msg += fmt.Sprintf("🔄 Updated: %s\n", config.GetUpdatedAt())

	if config.GetConfig() != nil {
		msg += "⚙️  Config:\n"
		for k, v := range config.GetConfig() {
			// Mask API key for security
			if k == "api_key" {
				msg += fmt.Sprintf("   %s: ****\n", k)
			} else {
				msg += fmt.Sprintf("   %s: %v\n", k, v)
			}
		}
	}

	_, err := writer.Write([]byte(msg))
	return err
}

func (f *LogForwardingFormatter) FormatDeleteSuccess(writer io.Writer, id string) error {
	msg := fmt.Sprintf("✅ Log forwarding config '%s' deleted successfully!\n", id)
	_, err := writer.Write([]byte(msg))
	return err
}
