package repository

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	sdkclient "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/client"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
)

type GpgKeyRepository interface {
	List(ctx context.Context) ([]responses.GpgKeyResponse, error)
	Get(ctx context.Context, id string) (responses.GpgKeyResponse, error)
	Generate(ctx context.Context, req requests.GenerateGpgKeyRequest) (responses.GpgKeyResponse, error)
	Delete(ctx context.Context, id string) error
	Revoke(ctx context.Context, id string, reason string) (responses.GpgKeyResponse, error)
	Export(ctx context.Context, id string) (responses.GpgExportResponse, error)
	Sign(ctx context.Context, req requests.SignDataRequest) (responses.GpgSignatureResponse, error)
	Verify(ctx context.Context, req requests.VerifySignatureRequest) (responses.GpgVerifyResponse, error)
}

type gpgKeyRepo struct {
	client *sdkclient.Client
}

func NewGpgKeyRepository() GpgKeyRepository {
	client := createSDKClient()
	return &gpgKeyRepo{client: client}
}

func (r *gpgKeyRepo) List(ctx context.Context) ([]responses.GpgKeyResponse, error) {
	keys, err := r.client.GpgKeys.ListGpgKeys(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]responses.GpgKeyResponse, len(keys))
	for i, k := range keys {
		result[i] = sdkGpgKeyToResponse(k)
	}

	return result, nil
}

func (r *gpgKeyRepo) Get(ctx context.Context, id string) (responses.GpgKeyResponse, error) {
	key, err := r.client.GpgKeys.GetGpgKey(ctx, id)
	if err != nil {
		return responses.GpgKeyResponse{}, err
	}

	return sdkGpgKeyDetailToResponse(key), nil
}

func (r *gpgKeyRepo) Generate(ctx context.Context, req requests.GenerateGpgKeyRequest) (responses.GpgKeyResponse, error) {
	algo, err := sdk.NewGenerateGpgKeyRequestAlgorithmFromString(req.Algorithm)
	if err != nil {
		return responses.GpgKeyResponse{}, err
	}

	usageFlags := make([]sdk.GenerateGpgKeyRequestUsageFlagsItem, len(req.UsageFlags))
	for i, f := range req.UsageFlags {
		flag, err := sdk.NewGenerateGpgKeyRequestUsageFlagsItemFromString(f)
		if err != nil {
			return responses.GpgKeyResponse{}, err
		}
		usageFlags[i] = flag
	}

	isDefault := req.IsDefault
	key, err := r.client.GpgKeys.GenerateGpgKey(ctx, &sdk.GenerateGpgKeyRequest{
		Name:          req.Name,
		Email:         req.Email,
		Algorithm:     algo,
		KeySize:       req.KeySize,
		UsageFlags:    usageFlags,
		ExpiresInDays: req.ExpiresInDays,
		IsDefault:     &isDefault,
	})
	if err != nil {
		return responses.GpgKeyResponse{}, err
	}

	return sdkGpgKeyToResponse(key), nil
}

func (r *gpgKeyRepo) Delete(ctx context.Context, id string) error {
	_, err := r.client.GpgKeys.DeleteGpgKey(ctx, id)
	return err
}

func (r *gpgKeyRepo) Revoke(ctx context.Context, id string, reason string) (responses.GpgKeyResponse, error) {
	var reasonPtr *string
	if reason != "" {
		reasonPtr = &reason
	}

	key, err := r.client.GpgKeys.RevokeGpgKey(ctx, id, &sdk.RevokeGpgKeyRequest{
		Reason: reasonPtr,
	})
	if err != nil {
		return responses.GpgKeyResponse{}, err
	}

	return sdkGpgKeyDetailToResponse(key), nil
}

func (r *gpgKeyRepo) Export(ctx context.Context, id string) (responses.GpgExportResponse, error) {
	resp, err := r.client.GpgKeys.ExportGpgPublicKey(ctx, id)
	if err != nil {
		return responses.GpgExportResponse{}, err
	}

	return responses.GpgExportResponse{
		PublicKey:   resp.PublicKey,
		Fingerprint: resp.Fingerprint,
	}, nil
}

func (r *gpgKeyRepo) Sign(ctx context.Context, req requests.SignDataRequest) (responses.GpgSignatureResponse, error) {
	var mode *sdk.SignDataRequestMode
	if req.Mode != "" {
		m, err := sdk.NewSignDataRequestModeFromString(req.Mode)
		if err != nil {
			return responses.GpgSignatureResponse{}, err
		}
		mode = &m
	}

	detached := req.Detached
	resp, err := r.client.GpgKeys.SignDataWithGpgKey(ctx, &sdk.SignDataRequest{
		GpgKeyId: req.GpgKeyID,
		Data:     req.Data,
		Mode:     mode,
		Detached: &detached,
	})
	if err != nil {
		return responses.GpgSignatureResponse{}, err
	}

	return responses.GpgSignatureResponse{
		Signature:   resp.Signature,
		KeyID:       resp.KeyId,
		Fingerprint: resp.Fingerprint,
	}, nil
}

func (r *gpgKeyRepo) Verify(ctx context.Context, req requests.VerifySignatureRequest) (responses.GpgVerifyResponse, error) {
	resp, err := r.client.GpgKeys.VerifyGpgSignature(ctx, &sdk.VerifySignatureRequest{
		Data:      req.Data,
		Signature: req.Signature,
		GpgKeyId:  req.GpgKeyID,
	})
	if err != nil {
		return responses.GpgVerifyResponse{}, err
	}

	return responses.GpgVerifyResponse{
		Valid:             resp.Valid,
		SignerFingerprint: resp.SignerFingerprint,
		SignerKeyID:       resp.SignerKeyId,
	}, nil
}

func sdkGpgKeyToResponse(k *sdk.GpgKeyResponse) responses.GpgKeyResponse {
	var keySize *int
	if k.KeySize != nil {
		ks := int(*k.KeySize)
		keySize = &ks
	}

	return responses.GpgKeyResponse{
		ID:          k.Id,
		Name:        k.Name,
		Email:       k.Email,
		Fingerprint: k.Fingerprint,
		KeyID:       k.KeyId,
		Algorithm:   k.Algorithm,
		KeySize:     keySize,
		UsageFlags:  k.UsageFlags,
		TrustLevel:  k.TrustLevel,
		ExpiresAt:   k.ExpiresAt,
		RevokedAt:   k.RevokedAt,
		IsDefault:   k.IsDefault,
		CreatedAt:   k.CreatedAt,
		UpdatedAt:   k.UpdatedAt,
	}
}

func sdkGpgKeyDetailToResponse(k *sdk.GpgKeyDetailResponse) responses.GpgKeyResponse {
	var keySize *int
	if k.KeySize != nil {
		ks := int(*k.KeySize)
		keySize = &ks
	}

	return responses.GpgKeyResponse{
		ID:          k.Id,
		Name:        k.Name,
		Email:       k.Email,
		Fingerprint: k.Fingerprint,
		KeyID:       k.KeyId,
		Algorithm:   k.Algorithm,
		KeySize:     keySize,
		UsageFlags:  k.UsageFlags,
		TrustLevel:  k.TrustLevel,
		ExpiresAt:   k.ExpiresAt,
		RevokedAt:   k.RevokedAt,
		IsDefault:   k.IsDefault,
		PublicKey:   k.PublicKey,
		CreatedAt:   k.CreatedAt,
		UpdatedAt:   k.UpdatedAt,
	}
}
