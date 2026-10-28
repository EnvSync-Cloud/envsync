package services

import (
	"context"
	"errors"
	"net/http"

	core "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/core"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/mappers"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type CertificateService interface {
	InitCA(ctx context.Context, req requests.InitOrgCARequest) (domain.Certificate, error)
	GetCA(ctx context.Context) (domain.Certificate, error)
	GetRootCA(ctx context.Context) (string, error)
	IssueMemberCert(ctx context.Context, req requests.IssueMemberCertRequest) (domain.Certificate, error)
	IssueLeafCert(ctx context.Context, req requests.IssueLeafCertRequest) (domain.Certificate, error)
	SignCsr(ctx context.Context, req requests.SignCsrRequest) (domain.Certificate, error)
	ListCerts(ctx context.Context) ([]domain.Certificate, error)
	RevokeCert(ctx context.Context, serialHex string, reason int) (responses.RevokeCertResponse, error)
	GetCRL(ctx context.Context) (domain.CRLResult, error)
	CheckOCSP(ctx context.Context, serialHex string) (domain.OCSPResult, error)
	RenewCert(ctx context.Context, id string, description string, revokePrevious bool) (domain.Certificate, error)
	RotateCert(ctx context.Context, id string, description string, revokePrevious bool, reason int) (domain.Certificate, error)
}

type certService struct {
	repo repository.CertificateRepository
}

func NewCertificateService() CertificateService {
	repo := repository.NewCertificateRepository()
	return &certService{repo: repo}
}

func (s *certService) InitCA(ctx context.Context, req requests.InitOrgCARequest) (result domain.Certificate, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.certificate.init_ca")
	defer end(&err)

	res, err := s.repo.InitCA(ctx, req)
	if err != nil {
		// Org creation already initializes the CA. The SDK returns a plain 409,
		// not the generated ConflictError type.
		if caAlreadyExists(err) {
			return s.GetCA(ctx)
		}
		return domain.Certificate{}, err
	}
	return mappers.OrgCAResponseToDomain(res), nil
}

func caAlreadyExists(err error) bool {
	var apiErr *core.APIError
	return errors.As(err, &apiErr) && apiErr.StatusCode == http.StatusConflict
}

func (s *certService) GetCA(ctx context.Context) (result domain.Certificate, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.certificate.get_ca")
	defer end(&err)

	res, err := s.repo.GetCA(ctx)
	if err != nil {
		return domain.Certificate{}, err
	}
	return mappers.OrgCAResponseToDomain(res), nil
}

func (s *certService) GetRootCA(ctx context.Context) (result string, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.certificate.get_root_ca")
	defer end(&err)

	res, err := s.repo.GetRootCA(ctx)
	if err != nil {
		return "", err
	}
	return res.CertPEM, nil
}

func (s *certService) IssueMemberCert(ctx context.Context, req requests.IssueMemberCertRequest) (result domain.Certificate, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.certificate.issue_member_cert")
	defer end(&err)

	res, err := s.repo.IssueMemberCert(ctx, req)
	if err != nil {
		return domain.Certificate{}, err
	}
	return mappers.MemberCertResponseToDomain(res), nil
}

func (s *certService) IssueLeafCert(ctx context.Context, req requests.IssueLeafCertRequest) (result domain.Certificate, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.certificate.issue_leaf_cert")
	defer end(&err)

	res, err := s.repo.IssueLeafCert(ctx, req)
	if err != nil {
		return domain.Certificate{}, err
	}
	return mappers.MemberCertResponseToDomain(res), nil
}

func (s *certService) SignCsr(ctx context.Context, req requests.SignCsrRequest) (result domain.Certificate, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.certificate.sign_csr")
	defer end(&err)

	res, err := s.repo.SignCsr(ctx, req)
	if err != nil {
		return domain.Certificate{}, err
	}
	return mappers.MemberCertResponseToDomain(res), nil
}

func (s *certService) ListCerts(ctx context.Context) (result []domain.Certificate, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.certificate.list_certs")
	defer end(&err)

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

func (s *certService) RevokeCert(ctx context.Context, serialHex string, reason int) (result responses.RevokeCertResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.certificate.revoke_cert")
	defer end(&err)

	return s.repo.Revoke(ctx, serialHex, requests.RevokeCertRequest{Reason: reason})
}

func (s *certService) GetCRL(ctx context.Context) (result domain.CRLResult, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.certificate.get_crl")
	defer end(&err)

	res, err := s.repo.GetCRL(ctx)
	if err != nil {
		return domain.CRLResult{}, err
	}
	return mappers.CRLResponseToDomain(res), nil
}

func (s *certService) CheckOCSP(ctx context.Context, serialHex string) (result domain.OCSPResult, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.certificate.check_ocsp")
	defer end(&err)

	res, err := s.repo.CheckOCSP(ctx, serialHex)
	if err != nil {
		return domain.OCSPResult{}, err
	}
	return mappers.OCSPResponseToDomain(res), nil
}

func (s *certService) RenewCert(ctx context.Context, id string, description string, revokePrevious bool) (result domain.Certificate, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.certificate.renew_cert")
	defer end(&err)

	res, err := s.repo.Renew(ctx, id, description, revokePrevious)
	if err != nil {
		return domain.Certificate{}, err
	}
	return mappers.MemberCertResponseToDomain(res), nil
}

func (s *certService) RotateCert(ctx context.Context, id string, description string, revokePrevious bool, reason int) (result domain.Certificate, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.certificate.rotate_cert")
	defer end(&err)

	res, err := s.repo.Rotate(ctx, id, description, revokePrevious, reason)
	if err != nil {
		return domain.Certificate{}, err
	}
	return mappers.MemberCertResponseToDomain(res), nil
}
