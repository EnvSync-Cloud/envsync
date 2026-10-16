package certificate

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type caStatusUseCase struct {
	service services.CertificateService
}

func NewCAStatusUseCase() CAStatusUseCase {
	service := services.NewCertificateService()
	return &caStatusUseCase{service: service}
}

func (uc *caStatusUseCase) Execute(ctx context.Context) (result *domain.Certificate, err error) {
	ctx, end := telemetry.StartSpan(ctx, "certificate.ca_status")
	defer end(&err)

	cert, err := uc.service.GetCA(ctx)
	if err != nil {
		return nil, NewServiceError("failed to get organization CA status", err)
	}

	return &cert, nil
}
