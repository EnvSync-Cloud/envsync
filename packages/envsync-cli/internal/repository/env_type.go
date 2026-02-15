package repository

import (
	"fmt"

	"resty.dev/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
)

type EnvTypeRepository interface {
	Create(*requests.EnvTypeRequest) (responses.EnvTypeResponse, error)
	GetAll() ([]responses.EnvTypeResponse, error)
	GetByID(id string) (responses.EnvTypeResponse, error)
	GetByAppID(appID string) ([]responses.EnvTypeResponse, error)
	Delete(string) error
}

type envTypeRepo struct {
	client *resty.Client
}

func NewEnvTypeRepository() EnvTypeRepository {
	client := createHTTPClient()

	return &envTypeRepo{
		client: client,
	}
}

func (e *envTypeRepo) Create(req *requests.EnvTypeRequest) (responses.EnvTypeResponse, error) {
	var res responses.EnvTypeResponse

	resp, err := e.client.R().
		SetBody(req).
		SetResult(&res).
		Post("/env_type")

	if err != nil {
		return responses.EnvTypeResponse{}, fmt.Errorf("failed to create environment type: %w", err)
	}

	if resp.StatusCode() != 201 {
		return responses.EnvTypeResponse{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return res, nil
}

func (e *envTypeRepo) GetAll() ([]responses.EnvTypeResponse, error) {
	var response []responses.EnvTypeResponse

	resp, err := e.client.R().
		SetResult(&response).
		Get("/env_type")

	if err != nil {
		return nil, err
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return response, nil
}

func (e *envTypeRepo) GetByID(id string) (responses.EnvTypeResponse, error) {
	var response responses.EnvTypeResponse

	resp, err := e.client.R().
		SetResult(&response).
		Get(fmt.Sprintf("/env_type/%s", id))

	if err != nil {
		return responses.EnvTypeResponse{}, err
	}

	if resp.StatusCode() != 200 {
		return responses.EnvTypeResponse{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return response, nil
}

func (e *envTypeRepo) GetByAppID(appID string) ([]responses.EnvTypeResponse, error) {
	var response []responses.EnvTypeResponse

	resp, err := e.client.R().
		SetResult(&response).
		Get("/env_type")

	if err != nil {
		return nil, err
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	// Filter the response by appID
	var filteredResponse []responses.EnvTypeResponse
	for _, envType := range response {
		if envType.AppID == appID {
			filteredResponse = append(filteredResponse, envType)
		}
	}

	return filteredResponse, nil
}

func (e *envTypeRepo) Delete(id string) error {
	resp, err := e.client.R().
		SetPathParam("id", id).
		Delete("/env_type/{id}")

	if err != nil {
		return fmt.Errorf("failed to delete environment type: %w", err)
	}

	if resp.StatusCode() != 200 {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return nil
}
