package repository

import (
	"fmt"

	"resty.dev/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
)

type RoleRepository interface {
	GetAll() ([]responses.RoleResponse, error)
}

type roleRepo struct {
	client *resty.Client
}

func NewRoleRepository() RoleRepository {
	client := createHTTPClient()

	return &roleRepo{
		client: client,
	}
}

func (a *roleRepo) GetAll() ([]responses.RoleResponse, error) {
	var roles []responses.RoleResponse

	resp, err := a.client.R().
		SetResult(&roles).
		Get("/role")

	if err != nil {
		return nil, err
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return roles, nil
}
