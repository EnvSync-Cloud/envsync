package services

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/mappers"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
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
	RotateKey(ctx context.Context, id string, payload map[string]any) (domain.GpgKey, error)
	ExtendExpiry(ctx context.Context, id string, expiresInDays int) (domain.GpgKey, error)
}

type gpgKeyService struct {
	repo repository.GpgKeyRepository
}

func NewGpgKeyService() GpgKeyService {
	repo := repository.NewGpgKeyRepository()
	return &gpgKeyService{repo: repo}
}

func (s *gpgKeyService) ListKeys(ctx context.Context) (result []domain.GpgKey, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.gpg_key.list_keys")
	defer end(&err)

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

func (s *gpgKeyService) GetKey(ctx context.Context, id string) (result domain.GpgKey, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.gpg_key.get_key")
	defer end(&err)

	res, err := s.repo.Get(ctx, id)
	if err != nil {
		return domain.GpgKey{}, err
	}
	return mappers.GpgKeyResponseToDomain(res), nil
}

func (s *gpgKeyService) GenerateKey(ctx context.Context, req requests.GenerateGpgKeyRequest) (result domain.GpgKey, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.gpg_key.generate_key")
	defer end(&err)

	res, err := s.repo.Generate(ctx, req)
	if err != nil {
		return domain.GpgKey{}, err
	}
	return mappers.GpgKeyResponseToDomain(res), nil
}

func (s *gpgKeyService) DeleteKey(ctx context.Context, id string) (err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.gpg_key.delete_key")
	defer end(&err)

	return s.repo.Delete(ctx, id)
}

func (s *gpgKeyService) RevokeKey(ctx context.Context, id string, reason string) (result domain.GpgKey, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.gpg_key.revoke_key")
	defer end(&err)

	res, err := s.repo.Revoke(ctx, id, reason)
	if err != nil {
		return domain.GpgKey{}, err
	}
	return mappers.GpgKeyResponseToDomain(res), nil
}

func (s *gpgKeyService) ExportKey(ctx context.Context, id string) (publicKey, fingerprint string, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.gpg_key.export_key")
	defer end(&err)

	res, err := s.repo.Export(ctx, id)
	if err != nil {
		return "", "", err
	}
	return res.PublicKey, res.Fingerprint, nil
}

func (s *gpgKeyService) Sign(ctx context.Context, req requests.SignDataRequest) (result domain.GpgSignatureResult, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.gpg_key.sign")
	defer end(&err)

	res, err := s.repo.Sign(ctx, req)
	if err != nil {
		return domain.GpgSignatureResult{}, err
	}
	return mappers.GpgSignatureResponseToDomain(res), nil
}

func (s *gpgKeyService) Verify(ctx context.Context, req requests.VerifySignatureRequest) (result domain.GpgVerifyResult, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.gpg_key.verify")
	defer end(&err)

	res, err := s.repo.Verify(ctx, req)
	if err != nil {
		return domain.GpgVerifyResult{}, err
	}
	return mappers.GpgVerifyResponseToDomain(res), nil
}

func (s *gpgKeyService) RotateKey(ctx context.Context, id string, payload map[string]any) (result domain.GpgKey, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.gpg_key.rotate_key")
	defer end(&err)

	res, err := s.repo.Rotate(ctx, id, payload)
	if err != nil {
		return domain.GpgKey{}, err
	}
	return mappers.GpgKeyResponseToDomain(res), nil
}

func (s *gpgKeyService) ExtendExpiry(ctx context.Context, id string, expiresInDays int) (result domain.GpgKey, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.gpg_key.extend_expiry")
	defer end(&err)

	res, err := s.repo.ExtendExpiry(ctx, id, expiresInDays)
	if err != nil {
		return domain.GpgKey{}, err
	}
	return mappers.GpgKeyResponseToDomain(res), nil
}
