package repository

import (
	"context"

	sdkclient "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/client"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
)

type RoleRepository interface {
	GetAll() ([]responses.RoleResponse, error)
}

type roleRepo struct {
	client *sdkclient.Client
}

func NewRoleRepository() RoleRepository {
	client := createSDKClient()

	return &roleRepo{
		client: client,
	}
}

func (a *roleRepo) GetAll() ([]responses.RoleResponse, error) {
	roles, err := a.client.Roles.GetAllRoles(context.Background())
	if err != nil {
		return nil, err
	}

	result := make([]responses.RoleResponse, len(roles))
	for i, r := range roles {
		var color string
		if r.Color != nil {
			color = *r.Color
		}

		result[i] = responses.RoleResponse{
			ID:          r.Id,
			OrgID:       r.OrgId,
			Name:        r.Name,
			CanEdit:     r.CanEdit,
			CanView:     r.CanView,
			HaveAPI:     r.HaveApiAccess,
			HaveBilling: r.HaveBillingOptions,
			HaveWebhook: r.HaveWebhookAccess,
			Color:       color,
			IsAdmin:     r.IsAdmin,
			IsMaster:    r.IsMaster,
			CreatedAt:   r.CreatedAt,
			UpdatedAt:   r.UpdatedAt,
		}
	}

	return result, nil
}
