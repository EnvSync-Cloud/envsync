package certificate

import (
	"context"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
)

type caStatusUseCase struct {
	service services.CertificateService
}

func NewCAStatusUseCase() CAStatusUseCase {
	service := services.NewCertificateService()
	return &caStatusUseCase{service: service}
}

func (uc *caStatusUseCase) Execute(ctx context.Context) (*domain.Certificate, error) {
	cert, err := uc.service.GetCA()
	if err != nil {
		return nil, NewServiceError("failed to get organization CA status", err)
	}

	return &cert, nil
}
