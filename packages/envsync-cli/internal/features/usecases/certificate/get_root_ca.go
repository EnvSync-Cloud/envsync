package certificate

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
)

type getRootCAUseCase struct {
	service services.CertificateService
}

func NewGetRootCAUseCase() GetRootCAUseCase {
	service := services.NewCertificateService()
	return &getRootCAUseCase{service: service}
}

func (uc *getRootCAUseCase) Execute(ctx context.Context) (string, error) {
	certPEM, err := uc.service.GetRootCA()
	if err != nil {
		return "", NewServiceError("failed to get root CA", err)
	}

	return certPEM, nil
}
