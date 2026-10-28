package certificate

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type initCAUseCase struct {
	service services.CertificateService
}

func NewInitCAUseCase() InitCAUseCase {
	service := services.NewCertificateService()
	return &initCAUseCase{service: service}
}

func (uc *initCAUseCase) Execute(ctx context.Context, orgName, description string) (result *domain.Certificate, err error) {
	ctx, end := telemetry.StartSpan(ctx, "certificate.init_ca",
		trace.WithAttributes(attribute.String("cert.org_name", orgName)))
	defer end(&err)

	if orgName == "" {
		return nil, NewValidationError("organization name is required", ErrOrgNameRequired)
	}

	req := requests.InitOrgCARequest{
		OrgName:     orgName,
		Description: description,
	}

	cert, err := uc.service.InitCA(ctx, req)
	if err != nil {
		return nil, NewServiceError("failed to initialize organization CA", err)
	}

	return &cert, nil
}
