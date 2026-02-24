package services

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/mappers"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
)

type CertificateService interface {
	InitCA(ctx context.Context, req requests.InitOrgCARequest) (domain.Certificate, error)
	GetCA(ctx context.Context) (domain.Certificate, error)
	GetRootCA(ctx context.Context) (string, error)
	IssueMemberCert(ctx context.Context, req requests.IssueMemberCertRequest) (domain.Certificate, error)
	ListCerts(ctx context.Context) ([]domain.Certificate, error)
	RevokeCert(ctx context.Context, serialHex string, reason int) (responses.RevokeCertResponse, error)
	GetCRL(ctx context.Context) (domain.CRLResult, error)
	CheckOCSP(ctx context.Context, serialHex string) (domain.OCSPResult, error)
}

type certService struct {
	repo repository.CertificateRepository
}

func NewCertificateService() CertificateService {
	repo := repository.NewCertificateRepository()
	return &certService{repo: repo}
}

func (s *certService) InitCA(ctx context.Context, req requests.InitOrgCARequest) (domain.Certificate, error) {
	res, err := s.repo.InitCA(ctx, req)
	if err != nil {
		return domain.Certificate{}, err
	}
	return mappers.OrgCAResponseToDomain(res), nil
}

func (s *certService) GetCA(ctx context.Context) (domain.Certificate, error) {
	res, err := s.repo.GetCA(ctx)
	if err != nil {
		return domain.Certificate{}, err
	}
	return mappers.OrgCAResponseToDomain(res), nil
}

func (s *certService) GetRootCA(ctx context.Context) (string, error) {
	res, err := s.repo.GetRootCA(ctx)
	if err != nil {
		return "", err
	}
	return res.CertPEM, nil
}

func (s *certService) IssueMemberCert(ctx context.Context, req requests.IssueMemberCertRequest) (domain.Certificate, error) {
	res, err := s.repo.IssueMemberCert(ctx, req)
	if err != nil {
		return domain.Certificate{}, err
	}
	return mappers.MemberCertResponseToDomain(res), nil
}

func (s *certService) ListCerts(ctx context.Context) ([]domain.Certificate, error) {
	res, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}

	certs := make([]domain.Certificate, len(res))
	for i, r := range res {
		certs[i] = mappers.CertificateResponseToDomain(r)
	}
	return certs, nil
}

func (s *certService) RevokeCert(ctx context.Context, serialHex string, reason int) (responses.RevokeCertResponse, error) {
	return s.repo.Revoke(ctx, serialHex, requests.RevokeCertRequest{Reason: reason})
}

func (s *certService) GetCRL(ctx context.Context) (domain.CRLResult, error) {
	res, err := s.repo.GetCRL(ctx)
	if err != nil {
		return domain.CRLResult{}, err
	}
	return mappers.CRLResponseToDomain(res), nil
}

func (s *certService) CheckOCSP(ctx context.Context, serialHex string) (domain.OCSPResult, error) {
	res, err := s.repo.CheckOCSP(ctx, serialHex)
	if err != nil {
		return domain.OCSPResult{}, err
	}
	return mappers.OCSPResponseToDomain(res), nil
}
