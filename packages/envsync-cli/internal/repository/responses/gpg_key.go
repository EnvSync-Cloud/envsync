package responses

type GpgKeyResponse struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Email       string   `json:"email"`
	Fingerprint string   `json:"fingerprint"`
	KeyID       string   `json:"key_id"`
	Algorithm   string   `json:"algorithm"`
	KeySize     *int     `json:"key_size"`
	UsageFlags  []string `json:"usage_flags"`
	TrustLevel  string   `json:"trust_level"`
	ExpiresAt   *string  `json:"expires_at"`
	RevokedAt   *string  `json:"revoked_at"`
	IsDefault   bool     `json:"is_default"`
	PublicKey   string   `json:"public_key,omitempty"`
	CreatedAt   string   `json:"created_at"`
	UpdatedAt   string   `json:"updated_at"`
}

type GpgSignatureResponse struct {
	Signature   string `json:"signature"`
	KeyID       string `json:"key_id"`
	Fingerprint string `json:"fingerprint"`
}

type GpgVerifyResponse struct {
	Valid             bool    `json:"valid"`
	SignerFingerprint *string `json:"signer_fingerprint"`
	SignerKeyID       *string `json:"signer_key_id"`
}

type GpgExportResponse struct {
	PublicKey   string `json:"public_key"`
	Fingerprint string `json:"fingerprint"`
}
