package repository

import (
	"context"
	"fmt"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	sdkclient "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/client"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
)

type CertificateRepository interface {
	InitCA(ctx context.Context, req requests.InitOrgCARequest) (responses.OrgCAResponse, error)
	GetCA(ctx context.Context) (responses.OrgCAResponse, error)
	GetRootCA(ctx context.Context) (responses.RootCAResponse, error)
	IssueMemberCert(ctx context.Context, req requests.IssueMemberCertRequest) (responses.MemberCertResponse, error)
	List(ctx context.Context) ([]responses.CertificateResponse, error)
	Revoke(ctx context.Context, serialHex string, req requests.RevokeCertRequest) (responses.RevokeCertResponse, error)
	GetCRL(ctx context.Context) (responses.CRLResponse, error)
	CheckOCSP(ctx context.Context, serialHex string) (responses.OCSPResponse, error)
}

type certRepo struct {
	client *sdkclient.Client
}

func NewCertificateRepository() CertificateRepository {
	client := createSDKClient()
	return &certRepo{client: client}
}

func (r *certRepo) InitCA(ctx context.Context, req requests.InitOrgCARequest) (responses.OrgCAResponse, error) {
	var desc *string
	if req.Description != "" {
		desc = &req.Description
	}

	resp, err := r.client.Certificates.InitOrgCa(ctx, &sdk.InitOrgCaRequest{
		OrgName:     req.OrgName,
		Description: desc,
	})
	if err != nil {
		return responses.OrgCAResponse{}, err
	}

	return sdkOrgCaToResponse(resp), nil
}

func (r *certRepo) GetCA(ctx context.Context) (responses.OrgCAResponse, error) {
	resp, err := r.client.Certificates.GetOrgCa(ctx)
	if err != nil {
		return responses.OrgCAResponse{}, err
	}

	return sdkOrgCaToResponse(resp), nil
}

func (r *certRepo) GetRootCA(ctx context.Context) (responses.RootCAResponse, error) {
	resp, err := r.client.Certificates.GetRootCa(ctx)
	if err != nil {
		return responses.RootCAResponse{}, err
	}

	return responses.RootCAResponse{
		CertPEM: resp.CertPem,
	}, nil
}

func (r *certRepo) IssueMemberCert(ctx context.Context, req requests.IssueMemberCertRequest) (responses.MemberCertResponse, error) {
	var desc *string
	if req.Description != "" {
		desc = &req.Description
	}

	resp, err := r.client.Certificates.IssueMemberCert(ctx, &sdk.IssueMemberCertRequest{
		MemberEmail: req.MemberEmail,
		Role:        req.Role,
		Description: desc,
		Metadata:    req.Metadata,
	})
	if err != nil {
		return responses.MemberCertResponse{}, err
	}

	metadata := make(map[string]string)
	for k, v := range resp.Metadata {
		if v != nil {
			metadata[k] = *v
		}
	}

	return responses.MemberCertResponse{
		ID:           resp.Id,
		OrgID:        resp.OrgId,
		SerialHex:    resp.SerialHex,
		CertType:     resp.CertType,
		SubjectCN:    resp.SubjectCn,
		SubjectEmail: resp.SubjectEmail,
		Status:       resp.Status,
		Metadata:     metadata,
		CertPEM:      resp.CertPem,
		KeyPEM:       resp.KeyPem,
		CreatedAt:    resp.CreatedAt,
	}, nil
}

func (r *certRepo) List(ctx context.Context) ([]responses.CertificateResponse, error) {
	certs, err := r.client.Certificates.ListCertificates(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]responses.CertificateResponse, len(certs))
	for i, c := range certs {
		metadata := make(map[string]string)
		for k, v := range c.Metadata {
			if v != nil {
				metadata[k] = *v
			}
		}

		result[i] = responses.CertificateResponse{
			ID:           c.Id,
			OrgID:        c.OrgId,
			SerialHex:    c.SerialHex,
			CertType:     c.CertType,
			SubjectCN:    c.SubjectCn,
			SubjectEmail: c.SubjectEmail,
			Status:       c.Status,
			NotBefore:    c.NotBefore,
			NotAfter:     c.NotAfter,
			Description:  c.Description,
			Metadata:     metadata,
			RevokedAt:    c.RevokedAt,
			CreatedAt:    c.CreatedAt,
			UpdatedAt:    c.UpdatedAt,
		}
	}

	return result, nil
}

func (r *certRepo) Revoke(ctx context.Context, serialHex string, req requests.RevokeCertRequest) (responses.RevokeCertResponse, error) {
	resp, err := r.client.Certificates.RevokeCert(ctx, serialHex, &sdk.RevokeCertRequest{
		Reason: req.Reason,
	})
	if err != nil {
		return responses.RevokeCertResponse{}, err
	}

	return responses.RevokeCertResponse{
		Message:   resp.Message,
		SerialHex: resp.SerialHex,
		Status:    resp.Status,
	}, nil
}

func (r *certRepo) GetCRL(ctx context.Context) (responses.CRLResponse, error) {
	resp, err := r.client.Certificates.GetCrl(ctx)
	if err != nil {
		return responses.CRLResponse{}, err
	}

	return responses.CRLResponse{
		CRLPEM:    resp.CrlPem,
		CRLNumber: int(resp.CrlNumber),
		IsDelta:   resp.IsDelta,
	}, nil
}

func (r *certRepo) CheckOCSP(ctx context.Context, serialHex string) (responses.OCSPResponse, error) {
	resp, err := r.client.Certificates.CheckOcsp(ctx, serialHex)
	if err != nil {
		return responses.OCSPResponse{}, fmt.Errorf("failed to check OCSP status: %w", err)
	}

	return responses.OCSPResponse{
		Status:    resp.Status,
		RevokedAt: resp.RevokedAt,
	}, nil
}

func sdkOrgCaToResponse(resp *sdk.OrgCaResponse) responses.OrgCAResponse {
	var certPem string
	if resp.CertPem != nil {
		certPem = *resp.CertPem
	}

	return responses.OrgCAResponse{
		ID:        resp.Id,
		OrgID:     resp.OrgId,
		SerialHex: resp.SerialHex,
		CertType:  resp.CertType,
		SubjectCN: resp.SubjectCn,
		Status:    resp.Status,
		CertPEM:   certPem,
		CreatedAt: resp.CreatedAt,
	}
}
