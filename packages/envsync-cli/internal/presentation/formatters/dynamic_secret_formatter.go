package formatters

import (
	"fmt"
	"io"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/style"
)

type DynamicSecretFormatter struct {
	*BaseFormatter
}

func NewDynamicSecretFormatter() *DynamicSecretFormatter {
	return &DynamicSecretFormatter{
		BaseFormatter: NewBaseFormatter(),
	}
}

// Engine formatters

func (f *DynamicSecretFormatter) FormatEngineList(writer io.Writer, engines sdk.DynamicSecretEnginesResponse) error {
	if len(engines) == 0 {
		_, err := writer.Write([]byte("No dynamic secret engines found.\n"))
		return err
	}

	output := fmt.Sprintf("Found %d dynamic secret engine(s):\n\n", len(engines))
	for _, e := range engines {
		enabled := "disabled"
		if e.Enabled {
			enabled = "enabled"
		}
		output += fmt.Sprintf("  ID: %s\n", e.Id)
		output += fmt.Sprintf("  Name: %s | Engine: %s | Status: %s\n", e.Name, e.EngineType, enabled)
		output += "\n"
	}

	_, err := writer.Write([]byte(output))
	return err
}

func (f *DynamicSecretFormatter) FormatEngineDetail(writer io.Writer, engine *sdk.DynamicSecretEngineResponse) error {
	enabled := "No"
	if engine.Enabled {
		enabled = "Yes"
	}

	output := style.BoxStyle.Render(fmt.Sprintf(
		"🔐 Dynamic Secret Engine\n\n"+
			"🆔 ID: %s\n"+
			"📛 Name: %s\n"+
			"🔧 Engine: %s\n"+
			"✅ Enabled: %s\n"+
			"🕐 Created: %s\n"+
			"🕐 Updated: %s\n",
		engine.Id,
		engine.Name,
		engine.EngineType,
		enabled,
		engine.CreatedAt,
		engine.UpdatedAt,
	))

	_, err := writer.Write([]byte(output + "\n"))
	return err
}

func (f *DynamicSecretFormatter) FormatCreateEngineSuccess(writer io.Writer, engine *sdk.DynamicSecretEngineResponse) error {
	output := style.BoxStyle.Render(fmt.Sprintf(
		"✅ Dynamic secret engine created successfully!\n\n"+
			"🆔 ID: %s\n"+
			"📛 Name: %s\n"+
			"🔧 Engine: %s\n",
		engine.Id,
		engine.Name,
		engine.EngineType,
	))

	_, err := writer.Write([]byte(output + "\n"))
	return err
}

func (f *DynamicSecretFormatter) FormatUpdateEngineSuccess(writer io.Writer, engine *sdk.DynamicSecretEngineResponse) error {
	output := style.BoxStyle.Render(fmt.Sprintf(
		"✅ Dynamic secret engine updated successfully!\n\n"+
			"🆔 ID: %s\n"+
			"📛 Name: %s\n"+
			"🔧 Engine: %s\n"+
			"✅ Enabled: %t\n",
		engine.Id,
		engine.Name,
		engine.EngineType,
		engine.Enabled,
	))

	_, err := writer.Write([]byte(output + "\n"))
	return err
}

// Lease formatters

func (f *DynamicSecretFormatter) FormatLeaseList(writer io.Writer, leases sdk.DynamicSecretLeasesResponse) error {
	if len(leases) == 0 {
		_, err := writer.Write([]byte("No dynamic secret leases found.\n"))
		return err
	}

	output := fmt.Sprintf("Found %d dynamic secret lease(s):\n\n", len(leases))
	for _, l := range leases {
		status := "active"
		if l.RevokedAt != nil {
			status = "revoked"
		}
		output += fmt.Sprintf("  ID: %s\n", l.Id)
		output += fmt.Sprintf("  Engine: %s | Variable: %s | Status: %s\n", l.EngineId, l.VariableKey, status)
		output += fmt.Sprintf("  Expires: %s\n", l.ExpiresAt)
		output += "\n"
	}

	_, err := writer.Write([]byte(output))
	return err
}

func (f *DynamicSecretFormatter) FormatLeaseDetail(writer io.Writer, lease *sdk.DynamicSecretLeaseResponse) error {
	status := "active"
	if lease.RevokedAt != nil {
		status = "revoked"
	}

	output := style.BoxStyle.Render(fmt.Sprintf(
		"🔑 Dynamic Secret Lease\n\n"+
			"🆔 ID: %s\n"+
			"🔧 Engine ID: %s\n"+
			"🔑 Variable: %s\n"+
			"📊 Status: %s\n"+
			"⏰ Expires: %s\n"+
			"🕐 Created: %s\n"+
			"🕐 Updated: %s\n",
		lease.Id,
		lease.EngineId,
		lease.VariableKey,
		status,
		lease.ExpiresAt,
		lease.CreatedAt,
		lease.UpdatedAt,
	))

	_, err := writer.Write([]byte(output + "\n"))
	return err
}

func (f *DynamicSecretFormatter) FormatCreateLeaseSuccess(writer io.Writer, lease *sdk.DynamicSecretLeaseResponse) error {
	output := style.BoxStyle.Render(fmt.Sprintf(
		"✅ Dynamic secret lease created successfully!\n\n"+
			"🆔 ID: %s\n"+
			"🔧 Engine ID: %s\n"+
			"🔑 Variable: %s\n"+
			"⏰ Expires: %s\n",
		lease.Id,
		lease.EngineId,
		lease.VariableKey,
		lease.ExpiresAt,
	))

	_, err := writer.Write([]byte(output + "\n"))
	return err
}

func (f *DynamicSecretFormatter) FormatRevokeLeaseSuccess(writer io.Writer, result *sdk.RevokeLeaseResponse) error {
	output := style.BoxStyle.Render(fmt.Sprintf(
		"✅ Dynamic secret lease revoked successfully!\n\n"+
			"💬 Message: %s\n"+
			"🆔 ID: %s\n",
		result.Message,
		result.Id,
	))

	_, err := writer.Write([]byte(output + "\n"))
	return err
}

func (f *DynamicSecretFormatter) FormatCleanupSuccess(writer io.Writer, result *sdk.CleanupResponse) error {
	output := style.BoxStyle.Render(fmt.Sprintf(
		"✅ Expired leases cleanup completed!\n\n"+
			"🧹 Cleaned: %d lease(s)\n",
		result.Cleaned,
	))

	_, err := writer.Write([]byte(output + "\n"))
	return err
}
