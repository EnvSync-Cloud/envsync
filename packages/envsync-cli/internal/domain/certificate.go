package domain

import "time"

type Certificate struct {
	ID               string            `json:"id"`
	OrgID            string            `json:"org_id"`
	SerialHex        string            `json:"serial_hex"`
	CertType         string            `json:"cert_type"`
	SubjectCN        string            `json:"subject_cn"`
	SubjectEmail     *string           `json:"subject_email,omitempty"`
	Status           string            `json:"status"`
	Description      *string           `json:"description,omitempty"`
	Metadata         map[string]string `json:"metadata,omitempty"`
	NotBefore        *time.Time        `json:"not_before,omitempty"`
	NotAfter         *time.Time        `json:"not_after,omitempty"`
	RevokedAt        *time.Time        `json:"revoked_at,omitempty"`
	RevocationReason *int              `json:"revocation_reason,omitempty"`
	CertPEM          string            `json:"cert_pem"`
	KeyPEM           string            `json:"key_pem"`
	CreatedAt        time.Time         `json:"created_at"`
}

type CRLResult struct {
	CRLPEM    string `json:"crl_pem"`
	CRLNumber int    `json:"crl_number"`
	IsDelta   bool   `json:"is_delta"`
}

type OCSPResult struct {
	Status    string  `json:"status"`
	RevokedAt *string `json:"revoked_at,omitempty"`
}
