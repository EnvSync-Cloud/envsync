package handlers

import (
	"context"
	"os"
	"strings"

	"github.com/urfave/cli/v3"

	certUC "github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/certificate"
	"github.com/EnvSync-Cloud/envsync-cli/internal/presentation/formatters"
)

type CertificateHandler struct {
	initCAUseCase    certUC.InitCAUseCase
	caStatusUseCase  certUC.CAStatusUseCase
	issueCertUseCase certUC.IssueCertUseCase
	listCertsUseCase certUC.ListCertsUseCase
	revokeCertUseCase certUC.RevokeCertUseCase
	checkOCSPUseCase certUC.CheckOCSPUseCase
	getCRLUseCase    certUC.GetCRLUseCase
	getRootCAUseCase certUC.GetRootCAUseCase
	formatter        *formatters.CertificateFormatter
}

func NewCertificateHandler(
	initCAUseCase certUC.InitCAUseCase,
	caStatusUseCase certUC.CAStatusUseCase,
	issueCertUseCase certUC.IssueCertUseCase,
	listCertsUseCase certUC.ListCertsUseCase,
	revokeCertUseCase certUC.RevokeCertUseCase,
	checkOCSPUseCase certUC.CheckOCSPUseCase,
	getCRLUseCase certUC.GetCRLUseCase,
	getRootCAUseCase certUC.GetRootCAUseCase,
	formatter *formatters.CertificateFormatter,
) *CertificateHandler {
	return &CertificateHandler{
		initCAUseCase:    initCAUseCase,
		caStatusUseCase:  caStatusUseCase,
		issueCertUseCase: issueCertUseCase,
		listCertsUseCase: listCertsUseCase,
		revokeCertUseCase: revokeCertUseCase,
		checkOCSPUseCase: checkOCSPUseCase,
		getCRLUseCase:    getCRLUseCase,
		getRootCAUseCase: getRootCAUseCase,
		formatter:        formatter,
	}
}

func (h *CertificateHandler) InitCA(ctx context.Context, cmd *cli.Command) error {
	orgName := cmd.String("org-name")
	description := cmd.String("description")

	cert, err := h.initCAUseCase.Execute(ctx, orgName, description)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, cert)
	}

	return h.formatter.FormatCAStatus(cmd.Writer, *cert)
}

func (h *CertificateHandler) CAStatus(ctx context.Context, cmd *cli.Command) error {
	cert, err := h.caStatusUseCase.Execute(ctx)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, cert)
	}

	return h.formatter.FormatCAStatus(cmd.Writer, *cert)
}

func (h *CertificateHandler) IssueCert(ctx context.Context, cmd *cli.Command) error {
	email := cmd.String("email")
	role := cmd.String("role")
	description := cmd.String("description")

	// Parse metadata from key=value,key=value format
	var metadata map[string]string
	metadataStr := cmd.String("metadata")
	if metadataStr != "" {
		metadata = make(map[string]string)
		pairs := strings.Split(metadataStr, ",")
		for _, pair := range pairs {
			kv := strings.SplitN(pair, "=", 2)
			if len(kv) == 2 {
				metadata[strings.TrimSpace(kv[0])] = strings.TrimSpace(kv[1])
			}
		}
	}

	cert, err := h.issueCertUseCase.Execute(ctx, email, role, description, metadata)
	if err != nil {
		return h.formatError(cmd, err)
	}

	// Save cert/key to files if output paths specified
	certPath := cmd.String("output-cert")
	keyPath := cmd.String("output-key")

	if certPath != "" && cert.CertPEM != "" {
		if err := os.WriteFile(certPath, []byte(cert.CertPEM+"\n"), 0644); err != nil {
			return h.formatter.FormatError(cmd.Writer, "Failed to write certificate: "+err.Error())
		}
	}
	if keyPath != "" && cert.KeyPEM != "" {
		if err := os.WriteFile(keyPath, []byte(cert.KeyPEM+"\n"), 0600); err != nil {
			return h.formatter.FormatError(cmd.Writer, "Failed to write key: "+err.Error())
		}
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, cert)
	}

	if err := h.formatter.FormatIssuedCert(cmd.Writer, *cert); err != nil {
		return err
	}

	if certPath != "" {
		h.formatter.FormatSuccess(cmd.Writer, "Certificate saved to "+certPath)
	}
	if keyPath != "" {
		h.formatter.FormatSuccess(cmd.Writer, "Private key saved to "+keyPath)
	}

	// Print PEM to stdout if no output files specified
	if certPath == "" && cert.CertPEM != "" {
		h.formatter.FormatCertPEM(cmd.Writer, cert.CertPEM)
	}
	if keyPath == "" && cert.KeyPEM != "" {
		h.formatter.FormatCertPEM(cmd.Writer, cert.KeyPEM)
	}

	return nil
}

func (h *CertificateHandler) ListCerts(ctx context.Context, cmd *cli.Command) error {
	certs, err := h.listCertsUseCase.Execute(ctx)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, certs)
	}

	return h.formatter.FormatCertList(cmd.Writer, certs)
}

func (h *CertificateHandler) RevokeCert(ctx context.Context, cmd *cli.Command) error {
	serial := cmd.String("serial")
	reason := int(cmd.Int("reason"))

	result, err := h.revokeCertUseCase.Execute(ctx, serial, reason)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, result)
	}

	return h.formatter.FormatRevoked(cmd.Writer, *result)
}

func (h *CertificateHandler) CheckOCSP(ctx context.Context, cmd *cli.Command) error {
	serial := cmd.String("serial")

	result, err := h.checkOCSPUseCase.Execute(ctx, serial)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, result)
	}

	return h.formatter.FormatOCSP(cmd.Writer, *result)
}

func (h *CertificateHandler) GetCRL(ctx context.Context, cmd *cli.Command) error {
	result, err := h.getCRLUseCase.Execute(ctx)
	if err != nil {
		return h.formatError(cmd, err)
	}

	// Write to file if output specified
	outputPath := cmd.String("output")
	if outputPath != "" {
		if err := os.WriteFile(outputPath, []byte(result.CRLPEM+"\n"), 0644); err != nil {
			return h.formatter.FormatError(cmd.Writer, "Failed to write CRL: "+err.Error())
		}
		return h.formatter.FormatSuccess(cmd.Writer, "CRL written to "+outputPath)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, result)
	}

	return h.formatter.FormatCRL(cmd.Writer, *result)
}

func (h *CertificateHandler) GetRootCA(ctx context.Context, cmd *cli.Command) error {
	certPEM, err := h.getRootCAUseCase.Execute(ctx)
	if err != nil {
		return h.formatError(cmd, err)
	}

	// Write to file if output specified
	outputPath := cmd.String("output")
	if outputPath != "" {
		if err := os.WriteFile(outputPath, []byte(certPEM+"\n"), 0644); err != nil {
			return h.formatter.FormatError(cmd.Writer, "Failed to write root CA: "+err.Error())
		}
		return h.formatter.FormatSuccess(cmd.Writer, "Root CA written to "+outputPath)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, map[string]string{"cert_pem": certPEM})
	}

	return h.formatter.FormatCertPEM(cmd.Writer, certPEM)
}

func (h *CertificateHandler) formatError(cmd *cli.Command, err error) error {
	if cmd.Bool("json") {
		return h.formatter.FormatJSONError(cmd.Writer, err)
	}

	switch e := err.(type) {
	case *certUC.CertError:
		switch e.Code {
		case certUC.CertErrorCodeNotFound:
			return h.formatter.FormatError(cmd.Writer, "Certificate not found: "+e.Message)
		case certUC.CertErrorCodeValidation:
			return h.formatter.FormatError(cmd.Writer, "Validation error: "+e.Message)
		default:
			return h.formatter.FormatError(cmd.Writer, "Error: "+e.Message)
		}
	default:
		return h.formatter.FormatError(cmd.Writer, "Unexpected error: "+err.Error())
	}
}
