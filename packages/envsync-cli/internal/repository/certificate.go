package repository

import (
	"fmt"

	"resty.dev/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
)

type CertificateRepository interface {
	InitCA(req requests.InitOrgCARequest) (responses.OrgCAResponse, error)
	GetCA() (responses.OrgCAResponse, error)
	GetRootCA() (responses.RootCAResponse, error)
	IssueMemberCert(req requests.IssueMemberCertRequest) (responses.MemberCertResponse, error)
	List() ([]responses.CertificateResponse, error)
	Revoke(serialHex string, req requests.RevokeCertRequest) (responses.RevokeCertResponse, error)
	GetCRL() (responses.CRLResponse, error)
	CheckOCSP(serialHex string) (responses.OCSPResponse, error)
}

type certRepo struct {
	client *resty.Client
}

func NewCertificateRepository() CertificateRepository {
	client := createHTTPClient()
	return &certRepo{client: client}
}

func (r *certRepo) InitCA(req requests.InitOrgCARequest) (responses.OrgCAResponse, error) {
	var result responses.OrgCAResponse

	resp, err := r.client.R().
		SetBody(req).
		SetResult(&result).
		Post("/certificate/ca/init")

	if err != nil {
		return responses.OrgCAResponse{}, err
	}

	if resp.StatusCode() != 201 {
		return responses.OrgCAResponse{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return result, nil
}

func (r *certRepo) GetCA() (responses.OrgCAResponse, error) {
	var result responses.OrgCAResponse

	resp, err := r.client.R().
		SetResult(&result).
		Get("/certificate/ca")

	if err != nil {
		return responses.OrgCAResponse{}, err
	}

	if resp.StatusCode() != 200 {
		return responses.OrgCAResponse{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return result, nil
}

func (r *certRepo) GetRootCA() (responses.RootCAResponse, error) {
	var result responses.RootCAResponse

	resp, err := r.client.R().
		SetResult(&result).
		Get("/certificate/root-ca")

	if err != nil {
		return responses.RootCAResponse{}, err
	}

	if resp.StatusCode() != 200 {
		return responses.RootCAResponse{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return result, nil
}

func (r *certRepo) IssueMemberCert(req requests.IssueMemberCertRequest) (responses.MemberCertResponse, error) {
	var result responses.MemberCertResponse

	resp, err := r.client.R().
		SetBody(req).
		SetResult(&result).
		Post("/certificate/issue")

	if err != nil {
		return responses.MemberCertResponse{}, err
	}

	if resp.StatusCode() != 201 {
		return responses.MemberCertResponse{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return result, nil
}

func (r *certRepo) List() ([]responses.CertificateResponse, error) {
	var result []responses.CertificateResponse

	resp, err := r.client.R().
		SetResult(&result).
		Get("/certificate")

	if err != nil {
		return nil, err
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return result, nil
}

func (r *certRepo) Revoke(serialHex string, req requests.RevokeCertRequest) (responses.RevokeCertResponse, error) {
	var result responses.RevokeCertResponse

	resp, err := r.client.R().
		SetPathParam("serial_hex", serialHex).
		SetBody(req).
		SetResult(&result).
		Post("/certificate/{serial_hex}/revoke")

	if err != nil {
		return responses.RevokeCertResponse{}, err
	}

	if resp.StatusCode() != 200 {
		return responses.RevokeCertResponse{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return result, nil
}

func (r *certRepo) GetCRL() (responses.CRLResponse, error) {
	var result responses.CRLResponse

	resp, err := r.client.R().
		SetResult(&result).
		Get("/certificate/crl")

	if err != nil {
		return responses.CRLResponse{}, err
	}

	if resp.StatusCode() != 200 {
		return responses.CRLResponse{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return result, nil
}

func (r *certRepo) CheckOCSP(serialHex string) (responses.OCSPResponse, error) {
	var result responses.OCSPResponse

	resp, err := r.client.R().
		SetPathParam("serial_hex", serialHex).
		SetResult(&result).
		Get("/certificate/{serial_hex}/ocsp")

	if err != nil {
		return responses.OCSPResponse{}, err
	}

	if resp.StatusCode() != 200 {
		return responses.OCSPResponse{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return result, nil
}
