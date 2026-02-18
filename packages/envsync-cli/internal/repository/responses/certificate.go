package responses

type OrgCAResponse struct {
	ID        string  `json:"id"`
	OrgID     string  `json:"org_id"`
	SerialHex string  `json:"serial_hex"`
	CertType  string  `json:"cert_type"`
	SubjectCN string  `json:"subject_cn"`
	Status    string  `json:"status"`
	CertPEM   string  `json:"cert_pem,omitempty"`
	CreatedAt string  `json:"created_at"`
}

type MemberCertResponse struct {
	ID           string            `json:"id"`
	OrgID        string            `json:"org_id"`
	SerialHex    string            `json:"serial_hex"`
	CertType     string            `json:"cert_type"`
	SubjectCN    string            `json:"subject_cn"`
	SubjectEmail *string           `json:"subject_email"`
	Status       string            `json:"status"`
	Metadata     map[string]string `json:"metadata,omitempty"`
	CertPEM      string            `json:"cert_pem"`
	KeyPEM       string            `json:"key_pem"`
	CreatedAt    string            `json:"created_at"`
}

type CertificateResponse struct {
	ID               string            `json:"id"`
	OrgID            string            `json:"org_id"`
	SerialHex        string            `json:"serial_hex"`
	CertType         string            `json:"cert_type"`
	SubjectCN        string            `json:"subject_cn"`
	SubjectEmail     *string           `json:"subject_email"`
	Status           string            `json:"status"`
	NotBefore        *string           `json:"not_before"`
	NotAfter         *string           `json:"not_after"`
	Description      *string           `json:"description"`
	Metadata         map[string]string `json:"metadata,omitempty"`
	RevokedAt        *string           `json:"revoked_at"`
	RevocationReason *int              `json:"revocation_reason"`
	CreatedAt        string            `json:"created_at"`
	UpdatedAt        string            `json:"updated_at"`
}

type RevokeCertResponse struct {
	Message   string `json:"message"`
	SerialHex string `json:"serial_hex"`
	Status    string `json:"status"`
}

type CRLResponse struct {
	CRLPEM    string `json:"crl_pem"`
	CRLNumber int    `json:"crl_number"`
	IsDelta   bool   `json:"is_delta"`
}

type OCSPResponse struct {
	Status    string  `json:"status"`
	RevokedAt *string `json:"revoked_at"`
}

type RootCAResponse struct {
	CertPEM string `json:"cert_pem"`
}
