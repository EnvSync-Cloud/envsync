package repository

import (
	"fmt"

	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
	"resty.dev/v3"
)

type SecretRepository interface {
	GetAll(string, string) ([]responses.SecretResponse, error)
	Reveal(string, string, []string) ([]responses.SecretResponse, error)
}

type secretRepo struct {
	client *resty.Client
}

func NewSecretRepository() SecretRepository {
	client := createHTTPClient()

	return &secretRepo{
		client: client,
	}
}

func (s *secretRepo) GetAll(appID, envTypeID string) ([]responses.SecretResponse, error) {
	var response []responses.SecretResponse

	body := requests.GetAllRequest{
		AppID:     appID,
		EnvTypeID: envTypeID,
	}

	resp, err := s.client.R().
		SetBody(body).
		SetResult(&response).
		Post("/secret")
	if err != nil {
		return nil, err
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return response, nil
}

func (s *secretRepo) Reveal(appID, envTypeID string, keys []string) ([]responses.SecretResponse, error) {
	var response []responses.SecretResponse

	body := requests.RevelRequest{
		AppID:     appID,
		EnvTypeID: envTypeID,
		Keys:      keys,
	}

	resp, err := s.client.R().
		SetBody(body).
		SetResult(&response).
		Post("/secret/reveal")
	if err != nil {
		return nil, err
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return response, nil
}
