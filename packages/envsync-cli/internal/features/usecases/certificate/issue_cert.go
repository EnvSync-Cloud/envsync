package certificate

import (
	"context"
	"os"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type issueCertUseCase struct {
	service services.CertificateService
}

func NewIssueCertUseCase() IssueCertUseCase {
	service := services.NewCertificateService()
	return &issueCertUseCase{service: service}
}

func (uc *issueCertUseCase) Execute(ctx context.Context, input IssueCertInput) (result *domain.Certificate, err error) {
	ctx, end := telemetry.StartSpan(ctx, "certificate.issue_cert",
		trace.WithAttributes(
			attribute.String("app.id", input.AppID),
			attribute.String("env.id", input.EnvTypeID),
			attribute.String("cert.common_name", input.CommonName),
			attribute.String("cert.email", input.Email),
			attribute.String("file.path", input.CSRPath),
		))
	defer end(&err)

	if input.CSRPath != "" {
		pemBytes, err := os.ReadFile(input.CSRPath)
		if err != nil {
			return nil, NewIOError("failed to read CSR file", err)
		}
		cert, err := uc.service.SignCsr(ctx, requests.SignCsrRequest{
			AppID:       input.AppID,
			CSRPEM:      string(pemBytes),
			TTLDays:     input.TTLDays,
			Description: input.Description,
		})
		if err != nil {
			return nil, NewServiceError("failed to sign CSR", err)
		}
		return &cert, nil
	}

	if input.AppID != "" {
		if input.CommonName == "" {
			return nil, NewValidationError("common name is required for service certificates", ErrCNRequired)
		}
		cert, err := uc.service.IssueLeafCert(ctx, requests.IssueLeafCertRequest{
			AppID:       input.AppID,
			EnvTypeID:   input.EnvTypeID,
			CommonName:  input.CommonName,
			SANs:        input.SANs,
			TTLDays:     input.TTLDays,
			Description: input.Description,
		})
		if err != nil {
			return nil, NewServiceError("failed to issue service certificate", err)
		}
		return &cert, nil
	}

	if input.Email == "" {
		return nil, NewValidationError("member email is required", ErrEmailRequired)
	}
	if input.Role == "" {
		return nil, NewValidationError("role is required", ErrRoleRequired)
	}

	cert, err := uc.service.IssueMemberCert(ctx, requests.IssueMemberCertRequest{
		MemberEmail: input.Email,
		Role:        input.Role,
		Description: input.Description,
		Metadata:    input.Metadata,
	})
	if err != nil {
		return nil, NewServiceError("failed to issue member certificate", err)
	}

	return &cert, nil
}
