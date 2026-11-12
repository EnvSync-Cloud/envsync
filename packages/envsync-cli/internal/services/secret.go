package services

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/mappers"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type SecretService interface {
	GetAllSecrets(ctx context.Context, ref domain.ProjectEnvRef) ([]domain.Secret, error)
	RevelSecrets(ctx context.Context, ref domain.ProjectEnvRef, keys []string) ([]domain.Secret, error)
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

func (s *secretService) GetAllSecrets(ctx context.Context, ref domain.ProjectEnvRef) (result []domain.Secret, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.secret.get_all_secrets")
	defer end(&err)

	sec, err := s.repo.GetAll(ctx, ref)
	if err != nil {
		return nil, err
	}

	var secrets []domain.Secret
	for _, secretResp := range sec {
		secrets = append(secrets, mappers.SecretResponseToDomain(secretResp))
	}

	return secrets, nil
}

func (s *secretService) RevelSecrets(ctx context.Context, ref domain.ProjectEnvRef, keys []string) (result []domain.Secret, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.secret.revel_secrets")
	defer end(&err)

	sec, err := s.repo.Reveal(ctx, ref, keys)
	if err != nil {
		return nil, err
	}

	var secrets []domain.Secret
	for _, secretResp := range sec {
		secrets = append(secrets, mappers.SecretResponseToDomain(secretResp))
	}

	return secrets, nil
}
