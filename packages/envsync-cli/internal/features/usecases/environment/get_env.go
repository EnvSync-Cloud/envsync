package environment

import (
	"context"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
)

type getEnvUseCase struct {
	envService services.EnvTypeService
}

func NewGetEnvUseCase() GetEnvUseCase {
	service := services.NewEnvTypeService()
	return &getEnvUseCase{
		envService: service,
	}
}

func (uc *getEnvUseCase) ExecuteByAppID(ctx context.Context, appID string) ([]domain.EnvType, error) {
	env, err := uc.envService.GetEnvTypesByAppID(appID)
	if err != nil {
		return nil, NewServiceError("failed to get environment by app ID", err)
	}
	return env, nil

}

func (uc *getEnvUseCase) ExecuteByID(ctx context.Context, id string) (domain.EnvType, error) {
	env, err := uc.envService.GetEnvTypeByID(id)
	if err != nil {
		return domain.EnvType{}, NewServiceError("failed to get environment by ID", err)
	}
	return env, nil
}
