package services

import (
	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/mappers"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository"
)

type SecretService interface {
	GetAllSecrets(string, string) ([]domain.Secret, error)
	RevelSecrets(string, string, []string) ([]domain.Secret, error)
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

func (s *secretService) GetAllSecrets(appID, envTypeID string) ([]domain.Secret, error) {
	sec, err := s.repo.GetAll(appID, envTypeID)
	if err != nil {
		return nil, err
	}

	var secrets []domain.Secret
	for _, secretResp := range sec {
		secrets = append(secrets, mappers.SecretResponseToDomain(secretResp))
	}

	return secrets, nil
}

func (s *secretService) RevelSecrets(appID string, envTypeID string, keys []string) ([]domain.Secret, error) {
	sec, err := s.repo.Reveal(appID, envTypeID, keys)
	if err != nil {
		return nil, err
	}

	var secrets []domain.Secret
	for _, secretResp := range sec {
		secrets = append(secrets, mappers.SecretResponseToDomain(secretResp))
	}

	return secrets, nil
}
