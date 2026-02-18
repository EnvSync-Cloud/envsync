package domain

import "time"

type Certificate struct {
	ID               string
	OrgID            string
	SerialHex        string
	CertType         string
	SubjectCN        string
	SubjectEmail     *string
	Status           string
	Description      *string
	Metadata         map[string]string
	NotBefore        *time.Time
	NotAfter         *time.Time
	RevokedAt        *time.Time
	RevocationReason *int
	CertPEM          string
	KeyPEM           string
	CreatedAt        time.Time
}

type CRLResult struct {
	CRLPEM    string
	CRLNumber int
	IsDelta   bool
}

type OCSPResult struct {
	Status    string
	RevokedAt *string
}
