package certificate

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
)

type initCAUseCase struct {
	service services.CertificateService
}

func NewInitCAUseCase() InitCAUseCase {
	service := services.NewCertificateService()
	return &initCAUseCase{service: service}
}

func (uc *initCAUseCase) Execute(ctx context.Context, orgName, description string) (*domain.Certificate, error) {
	if orgName == "" {
		return nil, NewValidationError("organization name is required", ErrOrgNameRequired)
	}

	req := requests.InitOrgCARequest{
		OrgName:     orgName,
		Description: description,
	}

	cert, err := uc.service.InitCA(req)
	if err != nil {
		return nil, NewServiceError("failed to initialize organization CA", err)
	}

	return &cert, nil
}
