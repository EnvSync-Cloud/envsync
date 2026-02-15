package repository

import (
	"fmt"

	"resty.dev/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
)

type ApplicationRepository interface {
	Create(app requests.ApplicationRequest) (responses.AppResponse, error)
	GetAll() ([]responses.AppResponse, error)
	Delete(id string) error
	GetByID(id string) (responses.AppResponse, error)
}

type appRepo struct {
	client *resty.Client
}

func NewApplicationRepository() ApplicationRepository {
	client := createHTTPClient()

	return &appRepo{
		client: client,
	}
}

func (a *appRepo) Create(app requests.ApplicationRequest) (responses.AppResponse, error) {
	var response responses.AppResponse

	resp, err := a.client.R().
		SetBody(app).
		SetResult(&response).
		Post("/app")

	if err != nil {
		return responses.AppResponse{}, err
	}

	if resp.StatusCode() != 201 {
		return responses.AppResponse{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return response, nil
}

func (a *appRepo) GetAll() ([]responses.AppResponse, error) {
	var apps []responses.AppResponse

	resp, err := a.client.R().
		SetResult(&apps).
		Get("/app")

	if err != nil {
		return nil, err
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return apps, nil
}

func (a *appRepo) Delete(id string) error {
	resp, err := a.client.R().
		SetPathParam("id", id).
		Delete("/app/{id}")

	if err != nil {
		return err
	}

	if resp.StatusCode() != 200 {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return nil
}

func (a *appRepo) GetByID(id string) (responses.AppResponse, error) {
	var app responses.AppResponse

	resp, err := a.client.R().
		SetPathParam("id", id).
		SetResult(&app).
		Get("/app/{id}")

	if err != nil {
		return responses.AppResponse{}, err
	}

	if resp.StatusCode() != 200 {
		return responses.AppResponse{}, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return app, nil
}
