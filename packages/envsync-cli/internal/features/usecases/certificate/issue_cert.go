package certificate

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
)

type issueCertUseCase struct {
	service services.CertificateService
}

func NewIssueCertUseCase() IssueCertUseCase {
	service := services.NewCertificateService()
	return &issueCertUseCase{service: service}
}

func (uc *issueCertUseCase) Execute(ctx context.Context, email, role, description string, metadata map[string]string) (*domain.Certificate, error) {
	if email == "" {
		return nil, NewValidationError("member email is required", ErrEmailRequired)
	}
	if role == "" {
		return nil, NewValidationError("role is required", ErrRoleRequired)
	}

	req := requests.IssueMemberCertRequest{
		MemberEmail: email,
		Role:        role,
		Description: description,
		Metadata:    metadata,
	}

	cert, err := uc.service.IssueMemberCert(ctx, req)
	if err != nil {
		return nil, NewServiceError("failed to issue member certificate", err)
	}

	return &cert, nil
}
