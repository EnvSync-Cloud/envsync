package repository

import (
	"fmt"

	"resty.dev/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
)

type EnvVariableRepository interface {
	GetAllEnv() ([]responses.EnvironmentVariable, error)
	BatchCreateEnv(env requests.BatchSyncEnvRequest) error
	BatchUpdateEnv(env requests.BatchSyncEnvRequest) error
	BatchDeleteEnv(env requests.BatchDeleteRequest) error
}

type syncRepo struct {
	client    *resty.Client
	appID     string
	envTypeID string
}

func NewEnvVariableRepository(appID, envTypeID string) EnvVariableRepository {
	client := createHTTPClient()

	return &syncRepo{
		client:    client,
		appID:     appID,
		envTypeID: envTypeID,
	}
}

func (s *syncRepo) GetAllEnv() ([]responses.EnvironmentVariable, error) {
	var env []responses.EnvironmentVariable

	res, err := s.client.
		R().
		SetResult(&env).
		SetBody(requests.EnvVariableRequest{
			AppID:     s.appID,
			EnvTypeID: s.envTypeID,
		}).
		Post("/env")

	if err != nil {
		return nil, err
	}

	if res.StatusCode() != 200 {
		return nil, fmt.Errorf("unexpected status code: %d", res.StatusCode())
	}

	return env, nil
}

func (s *syncRepo) BatchCreateEnv(env requests.BatchSyncEnvRequest) error {
	res, err := s.client.
		R().
		SetBody(env).
		Put("/env/batch")

	if err != nil {
		return err
	}

	if res.StatusCode() != 201 {
		return fmt.Errorf("unexpected status code: %d", res.StatusCode())
	}

	return nil
}

func (s *syncRepo) BatchUpdateEnv(env requests.BatchSyncEnvRequest) error {
	res, err := s.client.
		R().
		SetBody(env).
		Patch("/env/batch")

	if err != nil {
		return err
	}

	if res.StatusCode() != 200 {
		return fmt.Errorf("unexpected status code: %d", res.StatusCode())
	}

	return nil
}

func (s *syncRepo) BatchDeleteEnv(env requests.BatchDeleteRequest) error {
	res, err := s.client.
		R().
		SetAllowMethodDeletePayload(true).
		SetBody(env).
		Delete("/env/batch")

	if err != nil {
		return err
	}

	if res.StatusCode() != 200 {
		return fmt.Errorf("unexpected status code: %d", res.StatusCode())
	}

	return nil
}
