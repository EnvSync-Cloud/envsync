package certificate

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type listCertsUseCase struct {
	service services.CertificateService
}

func NewListCertsUseCase() ListCertsUseCase {
	service := services.NewCertificateService()
	return &listCertsUseCase{service: service}
}

func (uc *listCertsUseCase) Execute(ctx context.Context) (result []domain.Certificate, err error) {
	ctx, end := telemetry.StartSpan(ctx, "certificate.list_certs")
	defer end(&err)

	certs, err := uc.service.ListCerts(ctx)
	if err != nil {
		return nil, NewServiceError("failed to list certificates", err)
	}
	return certs, nil
}
