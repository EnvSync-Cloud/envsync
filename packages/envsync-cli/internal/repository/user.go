package repository

import (
	"fmt"

	"resty.dev/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
)

type UserRepository interface {
	GetAll() ([]responses.UserResponse, error)
}

type userRepo struct {
	client *resty.Client
}

func NewUserRepository() UserRepository {
	client := createHTTPClient()

	return &userRepo{
		client: client,
	}
}

func (a *userRepo) GetAll() ([]responses.UserResponse, error) {
	var users []responses.UserResponse

	resp, err := a.client.R().
		SetResult(&users).
		Get("/user")

	if err != nil {
		return nil, err
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode())
	}

	return users, nil
}
