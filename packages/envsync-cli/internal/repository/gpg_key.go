package repository

import (
	"fmt"

	"resty.dev/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
)

type GpgKeyRepository interface {
	List() ([]responses.GpgKeyResponse, error)
	Get(id string) (responses.GpgKeyResponse, error)
	Generate(req requests.GenerateGpgKeyRequest) (responses.GpgKeyResponse, error)
	Delete(id string) error
	Revoke(id string, reason string) (responses.GpgKeyResponse, error)
	Export(id string) (responses.GpgExportResponse, error)
	Sign(req requests.SignDataRequest) (responses.GpgSignatureResponse, error)
	Verify(req requests.VerifySignatureRequest) (responses.GpgVerifyResponse, error)
}

type gpgKeyRepo struct {
	client *resty.Client
}

func NewGpgKeyRepository() GpgKeyRepository {
	client := createHTTPClient()
	return &gpgKeyRepo{client: client}
}

func (r *gpgKeyRepo) List() ([]responses.GpgKeyResponse, error) {
	var result []responses.GpgKeyResponse

	resp, err := r.client.R().
		SetResult(&result).
		Get("/gpg_key")

	if err != nil {
		return nil, err
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return result, nil
}

func (r *gpgKeyRepo) Get(id string) (responses.GpgKeyResponse, error) {
	var result responses.GpgKeyResponse

	resp, err := r.client.R().
		SetPathParam("id", id).
		SetResult(&result).
		Get("/gpg_key/{id}")

	if err != nil {
		return responses.GpgKeyResponse{}, err
	}

	if resp.StatusCode() != 200 {
		return responses.GpgKeyResponse{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return result, nil
}

func (r *gpgKeyRepo) Generate(req requests.GenerateGpgKeyRequest) (responses.GpgKeyResponse, error) {
	var result responses.GpgKeyResponse

	resp, err := r.client.R().
		SetBody(req).
		SetResult(&result).
		Put("/gpg_key/generate")

	if err != nil {
		return responses.GpgKeyResponse{}, err
	}

	if resp.StatusCode() != 201 {
		return responses.GpgKeyResponse{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return result, nil
}

func (r *gpgKeyRepo) Delete(id string) error {
	resp, err := r.client.R().
		SetPathParam("id", id).
		Delete("/gpg_key/{id}")

	if err != nil {
		return err
	}

	if resp.StatusCode() != 200 {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return nil
}

func (r *gpgKeyRepo) Revoke(id string, reason string) (responses.GpgKeyResponse, error) {
	var result responses.GpgKeyResponse

	resp, err := r.client.R().
		SetPathParam("id", id).
		SetBody(map[string]string{"reason": reason}).
		SetResult(&result).
		Post("/gpg_key/{id}/revoke")

	if err != nil {
		return responses.GpgKeyResponse{}, err
	}

	if resp.StatusCode() != 200 {
		return responses.GpgKeyResponse{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return result, nil
}

func (r *gpgKeyRepo) Export(id string) (responses.GpgExportResponse, error) {
	var result responses.GpgExportResponse

	resp, err := r.client.R().
		SetPathParam("id", id).
		SetResult(&result).
		Get("/gpg_key/{id}/export")

	if err != nil {
		return responses.GpgExportResponse{}, err
	}

	if resp.StatusCode() != 200 {
		return responses.GpgExportResponse{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return result, nil
}

func (r *gpgKeyRepo) Sign(req requests.SignDataRequest) (responses.GpgSignatureResponse, error) {
	var result responses.GpgSignatureResponse

	resp, err := r.client.R().
		SetBody(req).
		SetResult(&result).
		Post("/gpg_key/sign")

	if err != nil {
		return responses.GpgSignatureResponse{}, err
	}

	if resp.StatusCode() != 200 {
		return responses.GpgSignatureResponse{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return result, nil
}

func (r *gpgKeyRepo) Verify(req requests.VerifySignatureRequest) (responses.GpgVerifyResponse, error) {
	var result responses.GpgVerifyResponse

	resp, err := r.client.R().
		SetBody(req).
		SetResult(&result).
		Post("/gpg_key/verify")

	if err != nil {
		return responses.GpgVerifyResponse{}, err
	}

	if resp.StatusCode() != 200 {
		return responses.GpgVerifyResponse{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return result, nil
}
