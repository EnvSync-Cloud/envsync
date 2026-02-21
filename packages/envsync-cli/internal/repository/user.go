package repository

import (
	"context"

	sdkclient "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/client"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
)

type UserRepository interface {
	GetAll() ([]responses.UserResponse, error)
}

type userRepo struct {
	client *sdkclient.Client
}

func NewUserRepository() UserRepository {
	client := createSDKClient()

	return &userRepo{
		client: client,
	}
}

func (a *userRepo) GetAll() ([]responses.UserResponse, error) {
	users, err := a.client.Users.GetUsers(context.Background())
	if err != nil {
		return nil, err
	}

	result := make([]responses.UserResponse, len(users))
	for i, u := range users {
		result[i] = responses.UserResponse{
			ID:        u.Id,
			Email:     u.Email,
			OrgID:     u.OrgId,
			RoleID:    u.RoleId,
			CreatedAt: u.CreatedAt,
			UpdatedAt: u.UpdatedAt,
		}
	}

	return result, nil
}
