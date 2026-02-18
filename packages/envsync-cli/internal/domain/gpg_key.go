package domain

import "time"

type GpgKey struct {
	ID          string
	Name        string
	Email       string
	Fingerprint string
	KeyID       string
	Algorithm   string
	KeySize     *int
	UsageFlags  []string
	TrustLevel  string
	ExpiresAt   *time.Time
	RevokedAt   *time.Time
	IsDefault   bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type GpgSignRequest struct {
	KeyID    string
	Data     string
	Mode     string
	Detached bool
}

type GpgSignatureResult struct {
	Signature   string
	KeyID       string
	Fingerprint string
}

type GpgVerifyResult struct {
	Valid             bool
	SignerFingerprint *string
	SignerKeyID       *string
}
