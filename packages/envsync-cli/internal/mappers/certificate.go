package mappers

import (
	"time"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
)

func CertificateResponseToDomain(res responses.CertificateResponse) domain.Certificate {
	var notBefore, notAfter, revokedAt *time.Time

	if res.NotBefore != nil {
		if t, err := time.Parse(time.RFC3339, *res.NotBefore); err == nil {
			notBefore = &t
		}
	}
	if res.NotAfter != nil {
		if t, err := time.Parse(time.RFC3339, *res.NotAfter); err == nil {
			notAfter = &t
		}
	}
	if res.RevokedAt != nil {
		if t, err := time.Parse(time.RFC3339, *res.RevokedAt); err == nil {
			revokedAt = &t
		}
	}

	createdAt, _ := time.Parse(time.RFC3339, res.CreatedAt)

	return domain.Certificate{
		ID:               res.ID,
		OrgID:            res.OrgID,
		SerialHex:        res.SerialHex,
		CertType:         res.CertType,
		SubjectCN:        res.SubjectCN,
		SubjectEmail:     res.SubjectEmail,
		Status:           res.Status,
		Description:      res.Description,
		Metadata:         res.Metadata,
		NotBefore:        notBefore,
		NotAfter:         notAfter,
		RevokedAt:        revokedAt,
		RevocationReason: res.RevocationReason,
		CreatedAt:        createdAt,
	}
}

func MemberCertResponseToDomain(res responses.MemberCertResponse) domain.Certificate {
	createdAt, _ := time.Parse(time.RFC3339, res.CreatedAt)

	return domain.Certificate{
		ID:           res.ID,
		OrgID:        res.OrgID,
		SerialHex:    res.SerialHex,
		CertType:     res.CertType,
		SubjectCN:    res.SubjectCN,
		SubjectEmail: res.SubjectEmail,
		Status:       res.Status,
		Metadata:     res.Metadata,
		CertPEM:      res.CertPEM,
		KeyPEM:       res.KeyPEM,
		CreatedAt:    createdAt,
	}
}

func OrgCAResponseToDomain(res responses.OrgCAResponse) domain.Certificate {
	createdAt, _ := time.Parse(time.RFC3339, res.CreatedAt)

	return domain.Certificate{
		ID:        res.ID,
		OrgID:     res.OrgID,
		SerialHex: res.SerialHex,
		CertType:  res.CertType,
		SubjectCN: res.SubjectCN,
		Status:    res.Status,
		CertPEM:   res.CertPEM,
		CreatedAt: createdAt,
	}
}

func CRLResponseToDomain(res responses.CRLResponse) domain.CRLResult {
	return domain.CRLResult{
		CRLPEM:    res.CRLPEM,
		CRLNumber: res.CRLNumber,
		IsDelta:   res.IsDelta,
	}
}

func OCSPResponseToDomain(res responses.OCSPResponse) domain.OCSPResult {
	return domain.OCSPResult{
		Status:    res.Status,
		RevokedAt: res.RevokedAt,
	}
}
