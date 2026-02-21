package services

import (
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/mappers"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
)

type CertificateService interface {
	InitCA(req requests.InitOrgCARequest) (domain.Certificate, error)
	GetCA() (domain.Certificate, error)
	GetRootCA() (string, error)
	IssueMemberCert(req requests.IssueMemberCertRequest) (domain.Certificate, error)
	ListCerts() ([]domain.Certificate, error)
	RevokeCert(serialHex string, reason int) (responses.RevokeCertResponse, error)
	GetCRL() (domain.CRLResult, error)
	CheckOCSP(serialHex string) (domain.OCSPResult, error)
}

type certService struct {
	repo repository.CertificateRepository
}

func NewCertificateService() CertificateService {
	repo := repository.NewCertificateRepository()
	return &certService{repo: repo}
}

func (s *certService) InitCA(req requests.InitOrgCARequest) (domain.Certificate, error) {
	res, err := s.repo.InitCA(req)
	if err != nil {
		return domain.Certificate{}, err
	}
	return mappers.OrgCAResponseToDomain(res), nil
}

func (s *certService) GetCA() (domain.Certificate, error) {
	res, err := s.repo.GetCA()
	if err != nil {
		return domain.Certificate{}, err
	}
	return mappers.OrgCAResponseToDomain(res), nil
}

func (s *certService) GetRootCA() (string, error) {
	res, err := s.repo.GetRootCA()
	if err != nil {
		return "", err
	}
	return res.CertPEM, nil
}

func (s *certService) IssueMemberCert(req requests.IssueMemberCertRequest) (domain.Certificate, error) {
	res, err := s.repo.IssueMemberCert(req)
	if err != nil {
		return domain.Certificate{}, err
	}
	return mappers.MemberCertResponseToDomain(res), nil
}

func (s *certService) ListCerts() ([]domain.Certificate, error) {
	res, err := s.repo.List()
	if err != nil {
		return nil, err
	}

	certs := make([]domain.Certificate, len(res))
	for i, r := range res {
		certs[i] = mappers.CertificateResponseToDomain(r)
	}
	return certs, nil
}

func (s *certService) RevokeCert(serialHex string, reason int) (responses.RevokeCertResponse, error) {
	return s.repo.Revoke(serialHex, requests.RevokeCertRequest{Reason: reason})
}

func (s *certService) GetCRL() (domain.CRLResult, error) {
	res, err := s.repo.GetCRL()
	if err != nil {
		return domain.CRLResult{}, err
	}
	return mappers.CRLResponseToDomain(res), nil
}

func (s *certService) CheckOCSP(serialHex string) (domain.OCSPResult, error) {
	res, err := s.repo.CheckOCSP(serialHex)
	if err != nil {
		return domain.OCSPResult{}, err
	}
	return mappers.OCSPResponseToDomain(res), nil
}
