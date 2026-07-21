package formatters

import (
	"fmt"
	"io"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/style"
)

type RotationFormatter struct {
	*BaseFormatter
}

func NewRotationFormatter() *RotationFormatter {
	return &RotationFormatter{
		BaseFormatter: NewBaseFormatter(),
	}
}

func (f *RotationFormatter) FormatPolicyList(writer io.Writer, policies sdk.RotationPoliciesResponse) error {
	if len(policies) == 0 {
		_, err := writer.Write([]byte("No rotation policies found.\n"))
		return err
	}

	output := fmt.Sprintf("Found %d rotation policy(ies):\n\n", len(policies))
	for _, p := range policies {
		enabled := "disabled"
		if p.Enabled {
			enabled = "enabled"
		}
		output += fmt.Sprintf("  ID: %s\n", p.Id)
		output += fmt.Sprintf("  Engine: %s | Variable: %s | Status: %s\n", p.EngineType, p.VariableKey, enabled)
		output += fmt.Sprintf("  Schedule: %s\n", p.ScheduleCron)
		output += "\n"
	}

	_, err := writer.Write([]byte(output))
	return err
}

func (f *RotationFormatter) FormatPolicyDetail(writer io.Writer, policy *sdk.RotationPolicyResponse) error {
	output := style.BoxStyle.Render(fmt.Sprintf(
		"🔄 Rotation Policy\n\n"+
			"🆔 ID: %s\n"+
			"🔧 Engine: %s\n"+
			"🔑 Variable: %s\n"+
			"📅 Schedule: %s\n"+
			"✅ Enabled: %t\n"+
			"⏱️  Dual Window: %.0f min\n"+
			"🕐 Created: %s\n"+
			"🕐 Updated: %s\n",
		policy.Id,
		policy.EngineType,
		policy.VariableKey,
		policy.ScheduleCron,
		policy.Enabled,
		policy.DualWindowMinutes,
		policy.CreatedAt,
		policy.UpdatedAt,
	))

	_, err := writer.Write([]byte(output + "\n"))
	return err
}

func (f *RotationFormatter) FormatCreateSuccess(writer io.Writer, policy *sdk.RotationPolicyResponse) error {
	output := style.BoxStyle.Render(fmt.Sprintf(
		"✅ Rotation policy created successfully!\n\n"+
			"🆔 ID: %s\n"+
			"🔧 Engine: %s\n"+
			"🔑 Variable: %s\n"+
			"📅 Schedule: %s\n",
		policy.Id,
		policy.EngineType,
		policy.VariableKey,
		policy.ScheduleCron,
	))

	_, err := writer.Write([]byte(output + "\n"))
	return err
}

func (f *RotationFormatter) FormatUpdateSuccess(writer io.Writer, policy *sdk.RotationPolicyResponse) error {
	output := style.BoxStyle.Render(fmt.Sprintf(
		"✅ Rotation policy updated successfully!\n\n"+
			"🆔 ID: %s\n"+
			"🔧 Engine: %s\n"+
			"📅 Schedule: %s\n"+
			"✅ Enabled: %t\n",
		policy.Id,
		policy.EngineType,
		policy.ScheduleCron,
		policy.Enabled,
	))

	_, err := writer.Write([]byte(output + "\n"))
	return err
}

func (f *RotationFormatter) FormatTriggerSuccess(writer io.Writer, result *sdk.TriggerRotationResponse) error {
	output := style.BoxStyle.Render(fmt.Sprintf(
		"✅ Rotation triggered successfully!\n\n"+
			"💬 Message: %s\n"+
			"🆔 State ID: %s\n"+
			"🆕 New Credential Stored: %t\n"+
			"⏰ Old Credential Expires: %s\n",
		result.Message,
		result.RotationStateId,
		result.NewCredentialStored,
		result.OldCredentialExpiresAt,
	))

	_, err := writer.Write([]byte(output + "\n"))
	return err
}

func (f *RotationFormatter) FormatStatesList(writer io.Writer, states sdk.RotationStatesResponse) error {
	if len(states) == 0 {
		_, err := writer.Write([]byte("No rotation states found.\n"))
		return err
	}

	output := fmt.Sprintf("Found %d rotation state(s):\n\n", len(states))
	for _, s := range states {
		revoked := "no"
		if s.OldCredentialRevoked {
			revoked = "yes"
		}
		output += fmt.Sprintf("  ID: %s\n", s.Id)
		output += fmt.Sprintf("  Rotated At: %s | Old Cred Revoked: %s\n", s.RotatedAt, revoked)
		output += fmt.Sprintf("  Old Cred Expires: %s\n", s.OldCredentialExpiresAt)
		output += "\n"
	}

	_, err := writer.Write([]byte(output))
	return err
}

func (f *RotationFormatter) FormatRevokeSuccess(writer io.Writer, result *sdk.RevokeOldCredentialResponse) error {
	output := style.BoxStyle.Render(fmt.Sprintf(
		"✅ Expired credentials revoked successfully!\n\n"+
			"💬 Message: %s\n"+
			"🕐 Revoked At: %s\n",
		result.Message,
		result.RevokedAt,
	))

	_, err := writer.Write([]byte(output + "\n"))
	return err
}
