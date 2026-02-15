package services

import (
	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/mappers"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository"
)

type UserService interface {
	GetAllUsers() ([]domain.User, error)
}

type user struct {
	userRepo repository.UserRepository
	roleRepo repository.RoleRepository
}

func NewUserService() UserService {
	userRepo := repository.NewUserRepository()
	roleRepo := repository.NewRoleRepository()

	return &user{
		userRepo: userRepo,
		roleRepo: roleRepo,
	}
}

func (u *user) GetAllUsers() ([]domain.User, error) {
	userRes, err := u.userRepo.GetAll()
	if err != nil {
		return nil, err
	}

	roleRes, err := u.roleRepo.GetAll()
	if err != nil {
		return nil, err
	}

	var users []domain.User
	for _, user := range userRes {
		for _, role := range roleRes {
			if user.RoleID == role.ID {
				users = append(users, mappers.UserResponseToDomain(user, role))
				break
			}
		}
	}

	if len(users) == 0 {
		return nil, nil // No users found
	}
	if len(roleRes) == 0 {
		return nil, nil // No roles found
	}

	return users, nil
}
