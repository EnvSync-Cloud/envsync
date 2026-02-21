package repository

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	sdkclient "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/client"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
)

type GpgKeyRepository interface {
	List() ([]responses.GpgKeyResponse, error)
	Get(id string) (responses.GpgKeyResponse, error)
	Generate(req requests.GenerateGpgKeyRequest) (responses.GpgKeyResponse, error)
	Delete(id string) error
	Revoke(id string, reason string) (responses.GpgKeyResponse, error)
	Export(id string) (responses.GpgExportResponse, error)
	Sign(req requests.SignDataRequest) (responses.GpgSignatureResponse, error)
	Verify(req requests.VerifySignatureRequest) (responses.GpgVerifyResponse, error)
}

type gpgKeyRepo struct {
	client *sdkclient.Client
}

func NewGpgKeyRepository() GpgKeyRepository {
	client := createSDKClient()
	return &gpgKeyRepo{client: client}
}

func (r *gpgKeyRepo) List() ([]responses.GpgKeyResponse, error) {
	keys, err := r.client.GpgKeys.ListGpgKeys(context.Background())
	if err != nil {
		return nil, err
	}

	result := make([]responses.GpgKeyResponse, len(keys))
	for i, k := range keys {
		result[i] = sdkGpgKeyToResponse(k)
	}

	return result, nil
}

func (r *gpgKeyRepo) Get(id string) (responses.GpgKeyResponse, error) {
	key, err := r.client.GpgKeys.GetGpgKey(context.Background(), id)
	if err != nil {
		return responses.GpgKeyResponse{}, err
	}

	return sdkGpgKeyDetailToResponse(key), nil
}

func (r *gpgKeyRepo) Generate(req requests.GenerateGpgKeyRequest) (responses.GpgKeyResponse, error) {
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
	key, err := r.client.GpgKeys.GenerateGpgKey(context.Background(), &sdk.GenerateGpgKeyRequest{
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

func (r *gpgKeyRepo) Delete(id string) error {
	_, err := r.client.GpgKeys.DeleteGpgKey(context.Background(), id)
	return err
}

func (r *gpgKeyRepo) Revoke(id string, reason string) (responses.GpgKeyResponse, error) {
	var reasonPtr *string
	if reason != "" {
		reasonPtr = &reason
	}

	key, err := r.client.GpgKeys.RevokeGpgKey(context.Background(), id, &sdk.RevokeGpgKeyRequest{
		Reason: reasonPtr,
	})
	if err != nil {
		return responses.GpgKeyResponse{}, err
	}

	return sdkGpgKeyDetailToResponse(key), nil
}

func (r *gpgKeyRepo) Export(id string) (responses.GpgExportResponse, error) {
	resp, err := r.client.GpgKeys.ExportGpgPublicKey(context.Background(), id)
	if err != nil {
		return responses.GpgExportResponse{}, err
	}

	return responses.GpgExportResponse{
		PublicKey:   resp.PublicKey,
		Fingerprint: resp.Fingerprint,
	}, nil
}

func (r *gpgKeyRepo) Sign(req requests.SignDataRequest) (responses.GpgSignatureResponse, error) {
	var mode *sdk.SignDataRequestMode
	if req.Mode != "" {
		m, err := sdk.NewSignDataRequestModeFromString(req.Mode)
		if err != nil {
			return responses.GpgSignatureResponse{}, err
		}
		mode = &m
	}

	detached := req.Detached
	resp, err := r.client.GpgKeys.SignDataWithGpgKey(context.Background(), &sdk.SignDataRequest{
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

func (r *gpgKeyRepo) Verify(req requests.VerifySignatureRequest) (responses.GpgVerifyResponse, error) {
	resp, err := r.client.GpgKeys.VerifyGpgSignature(context.Background(), &sdk.VerifySignatureRequest{
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
