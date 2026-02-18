package certificate

import (
	"context"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
)

type getCRLUseCase struct {
	service services.CertificateService
}

func NewGetCRLUseCase() GetCRLUseCase {
	service := services.NewCertificateService()
	return &getCRLUseCase{service: service}
}

func (uc *getCRLUseCase) Execute(ctx context.Context) (*domain.CRLResult, error) {
	result, err := uc.service.GetCRL()
	if err != nil {
		return nil, NewServiceError("failed to get CRL", err)
	}

	return &result, nil
}
