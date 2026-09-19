package certificate

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
)

type InitCAUseCase interface {
	Execute(ctx context.Context, orgName, description string) (*domain.Certificate, error)
}

type CAStatusUseCase interface {
	Execute(ctx context.Context) (*domain.Certificate, error)
}

type IssueCertInput struct {
	Email       string
	Role        string
	Description string
	Metadata    map[string]string
	AppID       string
	EnvTypeID   string
	CommonName  string
	SANs        []string
	CSRPath     string
	TTLDays     int
}

type IssueCertUseCase interface {
	Execute(ctx context.Context, input IssueCertInput) (*domain.Certificate, error)
}

type ListCertsUseCase interface {
	Execute(ctx context.Context) ([]domain.Certificate, error)
}

type RevokeCertUseCase interface {
	Execute(ctx context.Context, serialHex string, reason int) (*responses.RevokeCertResponse, error)
}

type CheckOCSPUseCase interface {
	Execute(ctx context.Context, serialHex string) (*domain.OCSPResult, error)
}

type GetCRLUseCase interface {
	Execute(ctx context.Context) (*domain.CRLResult, error)
}

type GetRootCAUseCase interface {
	Execute(ctx context.Context) (string, error)
}
