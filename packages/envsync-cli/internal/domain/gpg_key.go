package domain

import "time"

type GpgKey struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Email       string     `json:"email"`
	Fingerprint string     `json:"fingerprint"`
	KeyID       string     `json:"key_id"`
	Algorithm   string     `json:"algorithm"`
	KeySize     *int       `json:"key_size,omitempty"`
	UsageFlags  []string   `json:"usage_flags"`
	TrustLevel  string     `json:"trust_level"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	RevokedAt   *time.Time `json:"revoked_at,omitempty"`
	IsDefault   bool       `json:"is_default"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type GpgSignRequest struct {
	KeyID    string
	Data     string
	Mode     string
	Detached bool
}

type GpgSignatureResult struct {
	Signature   string `json:"signature"`
	KeyID       string `json:"key_id"`
	Fingerprint string `json:"fingerprint"`
}

type GpgVerifyResult struct {
	Valid             bool    `json:"valid"`
	SignerFingerprint *string `json:"signer_fingerprint,omitempty"`
	SignerKeyID       *string `json:"signer_key_id,omitempty"`
}
