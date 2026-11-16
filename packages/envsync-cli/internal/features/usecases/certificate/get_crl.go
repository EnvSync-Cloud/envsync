package certificate

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type getCRLUseCase struct {
	service services.CertificateService
}

func NewGetCRLUseCase() GetCRLUseCase {
	service := services.NewCertificateService()
	return &getCRLUseCase{service: service}
}

func (uc *getCRLUseCase) Execute(ctx context.Context) (crlResult *domain.CRLResult, err error) {
	ctx, end := telemetry.StartSpan(ctx, "certificate.get_crl")
	defer end(&err)

	result, err := uc.service.GetCRL(ctx)
	if err != nil {
		return nil, NewServiceError("failed to get CRL", err)
	}

	return &result, nil
}
