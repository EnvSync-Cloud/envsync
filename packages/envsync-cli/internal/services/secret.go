package services

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/mappers"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
)

type SecretService interface {
	GetAllSecrets(ctx context.Context, appID string, envTypeID string) ([]domain.Secret, error)
	RevelSecrets(ctx context.Context, appID string, envTypeID string, keys []string) ([]domain.Secret, error)
}

type secretService struct {
	repo repository.SecretRepository
}

func NewSecretService() SecretService {
	repo := repository.NewSecretRepository()
	return &secretService{
		repo: repo,
	}
}

func (s *secretService) GetAllSecrets(ctx context.Context, appID, envTypeID string) ([]domain.Secret, error) {
	sec, err := s.repo.GetAll(ctx, appID, envTypeID)
	if err != nil {
		return nil, err
	}

	var secrets []domain.Secret
	for _, secretResp := range sec {
		secrets = append(secrets, mappers.SecretResponseToDomain(secretResp))
	}

	return secrets, nil
}

func (s *secretService) RevelSecrets(ctx context.Context, appID string, envTypeID string, keys []string) ([]domain.Secret, error) {
	sec, err := s.repo.Reveal(ctx, appID, envTypeID, keys)
	if err != nil {
		return nil, err
	}

	var secrets []domain.Secret
	for _, secretResp := range sec {
		secrets = append(secrets, mappers.SecretResponseToDomain(secretResp))
	}

	return secrets, nil
}
