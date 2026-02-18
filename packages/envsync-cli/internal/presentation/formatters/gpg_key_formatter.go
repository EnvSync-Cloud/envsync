package formatters

import (
	"fmt"
	"io"
	"strings"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
)

type GpgKeyFormatter struct {
	*BaseFormatter
}

func NewGpgKeyFormatter() *GpgKeyFormatter {
	return &GpgKeyFormatter{BaseFormatter: NewBaseFormatter()}
}

func (f *GpgKeyFormatter) FormatKeyList(writer io.Writer, keys []domain.GpgKey) error {
	if len(keys) == 0 {
		return f.FormatWarning(writer, "No GPG keys found.")
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("%-36s  %-20s  %-30s  %-16s  %-10s  %-8s\n",
		"ID", "Name", "Email", "Fingerprint", "Algorithm", "Status"))
	sb.WriteString(strings.Repeat("─", 130) + "\n")

	for _, key := range keys {
		fp := key.Fingerprint
		if len(fp) > 16 {
			fp = fp[:4] + "..." + fp[len(fp)-8:]
		}

		status := "active"
		if key.RevokedAt != nil {
			status = "revoked"
		} else if key.ExpiresAt != nil && key.ExpiresAt.Before(key.CreatedAt) {
			status = "expired"
		}

		sb.WriteString(fmt.Sprintf("%-36s  %-20s  %-30s  %-16s  %-10s  %-8s\n",
			key.ID, truncate(key.Name, 20), truncate(key.Email, 30), fp, key.Algorithm, status))
	}

	_, err := writer.Write([]byte(sb.String()))
	return err
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
