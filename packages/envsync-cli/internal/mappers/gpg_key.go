package mappers

import (
	"time"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
)

func GpgKeyResponseToDomain(res responses.GpgKeyResponse) domain.GpgKey {
	var expiresAt *time.Time
	if res.ExpiresAt != nil {
		if t, err := time.Parse(time.RFC3339, *res.ExpiresAt); err == nil {
			expiresAt = &t
		}
	}

	var revokedAt *time.Time
	if res.RevokedAt != nil {
		if t, err := time.Parse(time.RFC3339, *res.RevokedAt); err == nil {
			revokedAt = &t
		}
	}

	createdAt, _ := time.Parse(time.RFC3339, res.CreatedAt)
	updatedAt, _ := time.Parse(time.RFC3339, res.UpdatedAt)

	return domain.GpgKey{
		ID:          res.ID,
		Name:        res.Name,
		Email:       res.Email,
		Fingerprint: res.Fingerprint,
		KeyID:       res.KeyID,
		Algorithm:   res.Algorithm,
		KeySize:     res.KeySize,
		UsageFlags:  res.UsageFlags,
		TrustLevel:  res.TrustLevel,
		ExpiresAt:   expiresAt,
		RevokedAt:   revokedAt,
		IsDefault:   res.IsDefault,
		CreatedAt:   createdAt,
		UpdatedAt:   updatedAt,
	}
}

func GpgSignatureResponseToDomain(res responses.GpgSignatureResponse) domain.GpgSignatureResult {
	return domain.GpgSignatureResult{
		Signature:   res.Signature,
		KeyID:       res.KeyID,
		Fingerprint: res.Fingerprint,
	}
}

func GpgVerifyResponseToDomain(res responses.GpgVerifyResponse) domain.GpgVerifyResult {
	return domain.GpgVerifyResult{
		Valid:             res.Valid,
		SignerFingerprint: res.SignerFingerprint,
		SignerKeyID:       res.SignerKeyID,
	}
}
