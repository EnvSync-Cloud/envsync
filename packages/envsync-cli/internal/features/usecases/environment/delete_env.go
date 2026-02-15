package environment

import (
	"context"

	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
)

type deleteEnvUseCase struct {
	envService services.EnvTypeService
}

func NewDeleteEnvUseCase() DeleteEnvUseCase {
	service := services.NewEnvTypeService()
	return &deleteEnvUseCase{
		envService: service,
	}
}

func (uc *deleteEnvUseCase) Execute(ctx context.Context, id string) error {
	if err := uc.envService.DeleteEnvType(id); err != nil {
		return NewServiceError("failed to delete environment", err)
	}
	return nil
}
