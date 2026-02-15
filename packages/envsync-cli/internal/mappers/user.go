package mappers

import (
	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
)

func UserResponseToDomain(
	userRes responses.UserResponse,
	roleRes responses.RoleResponse,
) domain.User {
	return domain.User{
		ID:    userRes.ID,
		Email: userRes.Email,
		Role:  roleRes.Name,
	}
}
