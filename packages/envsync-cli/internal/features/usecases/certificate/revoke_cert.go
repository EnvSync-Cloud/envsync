package certificate

import (
	"context"

	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
)

type revokeCertUseCase struct {
	service services.CertificateService
}

func NewRevokeCertUseCase() RevokeCertUseCase {
	service := services.NewCertificateService()
	return &revokeCertUseCase{service: service}
}

func (uc *revokeCertUseCase) Execute(ctx context.Context, serialHex string, reason int) (*responses.RevokeCertResponse, error) {
	if serialHex == "" {
		return nil, NewValidationError("certificate serial number is required", ErrSerialRequired)
	}

	result, err := uc.service.RevokeCert(serialHex, reason)
	if err != nil {
		return nil, NewServiceError("failed to revoke certificate", err)
	}

	return &result, nil
}
