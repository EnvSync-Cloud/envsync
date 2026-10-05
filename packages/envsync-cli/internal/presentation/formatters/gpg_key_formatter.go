package formatters

import (
	"fmt"
	"io"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
)

type GpgKeyFormatter struct {
	*BaseFormatter
}

func NewGpgKeyFormatter() *GpgKeyFormatter {
	return &GpgKeyFormatter{BaseFormatter: NewBaseFormatter()}
}

func (f *GpgKeyFormatter) FormatListTable(writer io.Writer, keys []domain.GpgKey) error {
	if len(keys) == 0 {
		_, err := writer.Write([]byte("📭 No GPG keys found.\n"))
		return err
	}

	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("\n📋 GPG Keys (%d)\n", len(keys)))
	sb.WriteString(strings.Repeat("─", 130) + "\n")
	sb.WriteString(fmt.Sprintf("%-36s %-20s %-30s %-16s %-10s %-8s\n",
		"ID", "NAME", "EMAIL", "FINGERPRINT", "ALGORITHM", "STATUS"))
	sb.WriteString(strings.Repeat("─", 130) + "\n")

	for _, key := range keys {
		sb.WriteString(fmt.Sprintf("%-36s %-20s %-30s %-16s %-10s %-8s\n",
			key.ID, truncate(key.Name, 18), truncate(key.Email, 28), ShortFingerprint(key.Fingerprint), key.Algorithm, GpgKeyStatus(key)))
	}

	sb.WriteString(strings.Repeat("─", 130) + "\n")

	_, err := writer.Write([]byte(sb.String()))
	return err
}

// ShortFingerprint abbreviates a fingerprint to its first four and last eight
// hex characters.
func ShortFingerprint(fp string) string {
	if len(fp) > 16 {
		return fp[:4] + "..." + fp[len(fp)-8:]
	}
	return fp
}

// GpgKeyStatus derives a display status when the backend did not send one.
func GpgKeyStatus(key domain.GpgKey) string {
	if key.Status != "" {
		return key.Status
	}
	if key.RevokedAt != nil {
		return "revoked"
	}
	if key.ExpiresAt != nil && key.ExpiresAt.Before(key.CreatedAt) {
		return "expired"
	}
	return "active"
}

func (f *GpgKeyFormatter) FormatKeyGenerated(writer io.Writer, key domain.GpgKey) error {
	msg := fmt.Sprintf("GPG key generated successfully!\n\n"+
		"  Name:        %s\n"+
		"  Email:       %s\n"+
		"  ID:          %s\n"+
		"  Fingerprint: %s\n"+
		"  Algorithm:   %s\n",
		key.Name, key.Email, key.ID, key.Fingerprint, key.Algorithm)

	return f.FormatSuccess(writer, msg)
}

func (f *GpgKeyFormatter) FormatSignResult(writer io.Writer, result domain.GpgSignatureResult) error {
	_, err := writer.Write([]byte(result.Signature))
	if err != nil {
		return err
	}
	_, err = writer.Write([]byte("\n"))
	return err
}

func (f *GpgKeyFormatter) FormatVerifyResult(writer io.Writer, result domain.GpgVerifyResult) error {
	if result.Valid {
		msg := "Signature is VALID"
		if result.SignerFingerprint != nil {
			msg += fmt.Sprintf("\n  Signer: %s", *result.SignerFingerprint)
		}
		return f.FormatSuccess(writer, msg)
	}

	return f.FormatError(writer, "Signature is INVALID")
}

func (f *GpgKeyFormatter) FormatExport(writer io.Writer, publicKey string) error {
	_, err := writer.Write([]byte(publicKey))
	if err != nil {
		return err
	}
	_, err = writer.Write([]byte("\n"))
	return err
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
