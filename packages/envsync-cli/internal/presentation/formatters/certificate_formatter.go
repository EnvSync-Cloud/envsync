package formatters

import (
	"fmt"
	"io"
	"strings"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
)

type CertificateFormatter struct {
	*BaseFormatter
}

func NewCertificateFormatter() *CertificateFormatter {
	return &CertificateFormatter{BaseFormatter: NewBaseFormatter()}
}

func (f *CertificateFormatter) FormatCertList(writer io.Writer, certs []domain.Certificate) error {
	if len(certs) == 0 {
		return f.FormatWarning(writer, "No certificates found.")
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("%-36s  %-8s  %-30s  %-12s  %-10s  %-20s\n",
		"Serial", "Type", "Subject", "Status", "Email", "Created"))
	sb.WriteString(strings.Repeat("─", 130) + "\n")

	for _, cert := range certs {
		email := ""
		if cert.SubjectEmail != nil {
			email = *cert.SubjectEmail
		}

		sb.WriteString(fmt.Sprintf("%-36s  %-8s  %-30s  %-12s  %-10s  %-20s\n",
			cert.SerialHex, cert.CertType, truncate(cert.SubjectCN, 30), cert.Status,
			truncate(email, 10), cert.CreatedAt.Format("2006-01-02 15:04")))
	}

	_, err := writer.Write([]byte(sb.String()))
	return err
}

func (f *CertificateFormatter) FormatCAStatus(writer io.Writer, cert domain.Certificate) error {
	msg := fmt.Sprintf("Organization CA Status\n\n"+
		"  Subject:    %s\n"+
		"  Serial:     %s\n"+
		"  Status:     %s\n"+
		"  Created:    %s\n",
		cert.SubjectCN, cert.SerialHex, cert.Status, cert.CreatedAt.Format("2006-01-02 15:04:05"))

	if cert.CertPEM != "" {
		msg += fmt.Sprintf("  Cert PEM:   (available)\n")
	}

	return f.FormatSuccess(writer, msg)
}

func (f *CertificateFormatter) FormatIssuedCert(writer io.Writer, cert domain.Certificate) error {
	msg := fmt.Sprintf("Certificate issued successfully!\n\n"+
		"  Subject:    %s\n"+
		"  Serial:     %s\n"+
		"  Status:     %s\n",
		cert.SubjectCN, cert.SerialHex, cert.Status)

	return f.FormatSuccess(writer, msg)
}

func (f *CertificateFormatter) FormatCertPEM(writer io.Writer, pem string) error {
	_, err := writer.Write([]byte(pem))
	if err != nil {
		return err
	}
	_, err = writer.Write([]byte("\n"))
	return err
}

func (f *CertificateFormatter) FormatRevoked(writer io.Writer, result responses.RevokeCertResponse) error {
	msg := fmt.Sprintf("Certificate revoked: %s (status: %s)", result.SerialHex, result.Status)
	return f.FormatSuccess(writer, msg)
}

func (f *CertificateFormatter) FormatOCSP(writer io.Writer, result domain.OCSPResult) error {
	msg := fmt.Sprintf("OCSP Status: %s", result.Status)
	if result.RevokedAt != nil {
		msg += fmt.Sprintf("\n  Revoked At: %s", *result.RevokedAt)
	}

	if result.Status == "good" {
		return f.FormatSuccess(writer, msg)
	}
	return f.FormatWarning(writer, msg)
}

func (f *CertificateFormatter) FormatCRL(writer io.Writer, result domain.CRLResult) error {
	_, err := writer.Write([]byte(result.CRLPEM))
	if err != nil {
		return err
	}
	_, err = writer.Write([]byte("\n"))
	return err
}
