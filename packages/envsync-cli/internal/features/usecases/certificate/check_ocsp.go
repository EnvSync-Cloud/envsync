package certificate

import (
	"context"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
)

type checkOCSPUseCase struct {
	service services.CertificateService
}

func NewCheckOCSPUseCase() CheckOCSPUseCase {
	service := services.NewCertificateService()
	return &checkOCSPUseCase{service: service}
}

func (uc *checkOCSPUseCase) Execute(ctx context.Context, serialHex string) (*domain.OCSPResult, error) {
	if serialHex == "" {
		return nil, NewValidationError("certificate serial number is required", ErrSerialRequired)
	}

	result, err := uc.service.CheckOCSP(serialHex)
	if err != nil {
		return nil, NewServiceError("failed to check OCSP status", err)
	}

	return &result, nil
}
