package services

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
)

type ServiceTokenService interface {
	CreateServiceToken(ctx context.Context, req *sdk.CreateServiceTokenRequest) (*sdk.CreateServiceTokenResponse, error)
	GetAllServiceTokens(ctx context.Context) (sdk.ServiceTokensResponse, error)
	GetServiceToken(ctx context.Context, id string) (*sdk.ServiceTokenResponse, error)
	DeleteServiceToken(ctx context.Context, id string) error
}

type serviceTokenService struct {
	repo repository.ServiceTokenRepository
}

func NewServiceTokenService() ServiceTokenService {
	repo := repository.NewServiceTokenRepository()
	return &serviceTokenService{
		repo: repo,
	}
}

func (s *serviceTokenService) CreateServiceToken(ctx context.Context, req *sdk.CreateServiceTokenRequest) (*sdk.CreateServiceTokenResponse, error) {
	return s.repo.Create(ctx, req)
}

func (s *serviceTokenService) GetAllServiceTokens(ctx context.Context) (sdk.ServiceTokensResponse, error) {
	return s.repo.GetAll(ctx)
}

func (s *serviceTokenService) GetServiceToken(ctx context.Context, id string) (*sdk.ServiceTokenResponse, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *serviceTokenService) DeleteServiceToken(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}
