package services

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/mappers"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
)

type GpgKeyService interface {
	ListKeys(ctx context.Context) ([]domain.GpgKey, error)
	GetKey(ctx context.Context, id string) (domain.GpgKey, error)
	GenerateKey(ctx context.Context, req requests.GenerateGpgKeyRequest) (domain.GpgKey, error)
	DeleteKey(ctx context.Context, id string) error
	RevokeKey(ctx context.Context, id string, reason string) (domain.GpgKey, error)
	ExportKey(ctx context.Context, id string) (string, string, error)
	Sign(ctx context.Context, req requests.SignDataRequest) (domain.GpgSignatureResult, error)
	Verify(ctx context.Context, req requests.VerifySignatureRequest) (domain.GpgVerifyResult, error)
}

type gpgKeyService struct {
	repo repository.GpgKeyRepository
}

func NewGpgKeyService() GpgKeyService {
	repo := repository.NewGpgKeyRepository()
	return &gpgKeyService{repo: repo}
}

func (s *gpgKeyService) ListKeys(ctx context.Context) ([]domain.GpgKey, error) {
	res, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}

	keys := make([]domain.GpgKey, len(res))
	for i, r := range res {
		keys[i] = mappers.GpgKeyResponseToDomain(r)
	}
	return keys, nil
}

func (s *gpgKeyService) GetKey(ctx context.Context, id string) (domain.GpgKey, error) {
	res, err := s.repo.Get(ctx, id)
	if err != nil {
		return domain.GpgKey{}, err
	}
	return mappers.GpgKeyResponseToDomain(res), nil
}

func (s *gpgKeyService) GenerateKey(ctx context.Context, req requests.GenerateGpgKeyRequest) (domain.GpgKey, error) {
	res, err := s.repo.Generate(ctx, req)
	if err != nil {
		return domain.GpgKey{}, err
	}
	return mappers.GpgKeyResponseToDomain(res), nil
}

func (s *gpgKeyService) DeleteKey(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *gpgKeyService) RevokeKey(ctx context.Context, id string, reason string) (domain.GpgKey, error) {
	res, err := s.repo.Revoke(ctx, id, reason)
	if err != nil {
		return domain.GpgKey{}, err
	}
	return mappers.GpgKeyResponseToDomain(res), nil
}

func (s *gpgKeyService) ExportKey(ctx context.Context, id string) (string, string, error) {
	res, err := s.repo.Export(ctx, id)
	if err != nil {
		return "", "", err
	}
	return res.PublicKey, res.Fingerprint, nil
}

func (s *gpgKeyService) Sign(ctx context.Context, req requests.SignDataRequest) (domain.GpgSignatureResult, error) {
	res, err := s.repo.Sign(ctx, req)
	if err != nil {
		return domain.GpgSignatureResult{}, err
	}
	return mappers.GpgSignatureResponseToDomain(res), nil
}

func (s *gpgKeyService) Verify(ctx context.Context, req requests.VerifySignatureRequest) (domain.GpgVerifyResult, error) {
	res, err := s.repo.Verify(ctx, req)
	if err != nil {
		return domain.GpgVerifyResult{}, err
	}
	return mappers.GpgVerifyResponseToDomain(res), nil
}
