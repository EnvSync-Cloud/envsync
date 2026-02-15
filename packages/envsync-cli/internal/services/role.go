package services

import (
	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/mappers"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository"
)

type RoleService interface {
	GetAllRoles() ([]domain.Role, error)
}

type role struct {
	roleRepo repository.RoleRepository
}

func NewRoleService() RoleService {
	roleRepo := repository.NewRoleRepository()

	return &role{
		roleRepo: roleRepo,
	}
}

func (r *role) GetAllRoles() ([]domain.Role, error) {
	roleRes, err := r.roleRepo.GetAll()
	if err != nil {
		return nil, err
	}

	if len(roleRes) == 0 {
		return nil, nil // No roles found
	}

	var roles []domain.Role
	for _, role := range roleRes {
		roles = append(roles, mappers.RoleResponseToDomain(role))
	}

	return roles, nil
}
