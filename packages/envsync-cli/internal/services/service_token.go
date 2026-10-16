package services

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/mappers"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type ServiceTokenService interface {
	CreateServiceToken(ctx context.Context, st *domain.ServiceToken) (domain.ServiceToken, error)
	GetAllServiceTokens(ctx context.Context) ([]domain.ServiceToken, error)
	GetServiceToken(ctx context.Context, id string) (domain.ServiceToken, error)
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

func (s *serviceTokenService) CreateServiceToken(ctx context.Context, st *domain.ServiceToken) (result domain.ServiceToken, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.service_token.create_service_token")
	defer end(&err)

	req := mappers.DomainToServiceTokenRequest(st)

	res, err := s.repo.Create(ctx, req)
	if err != nil {
		return domain.ServiceToken{}, err
	}

	return mappers.ServiceTokenResponseToDomain(res), nil
}

func (s *serviceTokenService) GetAllServiceTokens(ctx context.Context) (result []domain.ServiceToken, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.service_token.get_all_service_tokens")
	defer end(&err)

	res, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, err
	}

	tokens := make([]domain.ServiceToken, len(res))
	for i, tokenResp := range res {
		tokens[i] = mappers.ServiceTokenResponseToDomain(tokenResp)
	}

	return tokens, nil
}

func (s *serviceTokenService) GetServiceToken(ctx context.Context, id string) (result domain.ServiceToken, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.service_token.get_service_token")
	defer end(&err)

	res, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.ServiceToken{}, err
	}

	return mappers.ServiceTokenResponseToDomain(res), nil
}

func (s *serviceTokenService) DeleteServiceToken(ctx context.Context, id string) (err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.service_token.delete_service_token")
	defer end(&err)

	return s.repo.Delete(ctx, id)
}
