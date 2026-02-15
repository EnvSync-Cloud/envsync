package mappers

import (
	"strings"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
)

func RoleResponseToDomain(
	roleRes responses.RoleResponse,
) domain.Role {
	admin := roleRes.IsAdmin || roleRes.IsMaster

	privileges := []string{}
	if roleRes.CanEdit {
		privileges = append(privileges, "edit")
	}
	if roleRes.CanView {
		privileges = append(privileges, "view")
	}
	if roleRes.HaveAPI {
		privileges = append(privileges, "api_access")
	}
	if roleRes.HaveBilling {
		privileges = append(privileges, "billing_options")
	}
	if roleRes.HaveWebhook {
		privileges = append(privileges, "webhook_access")
	}

	return domain.Role{
		ID:         roleRes.ID,
		Name:       roleRes.Name,
		Privileges: strings.Join(privileges, ", "),
		Color:      roleRes.Color,
		Admin:      admin,
	}
}
