package dynamic_secret

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type createEngineUseCase struct {
	dynamicSecretService services.DynamicSecretService
}

func NewCreateEngineUseCase() CreateEngineUseCase {
	return &createEngineUseCase{
		dynamicSecretService: services.NewDynamicSecretService(),
	}
}

func (uc *createEngineUseCase) Execute(ctx context.Context, req *sdk.CreateDynamicSecretEngineRequest) (*sdk.DynamicSecretEngineResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "dynamic_secret.create_engine")
	defer span.End()

	if err := uc.validateCreateRequest(req); err != nil {
		return nil, err
	}

	engine, err := uc.dynamicSecretService.CreateEngine(ctx, req)
	if err != nil {
		return nil, NewServiceError("failed to create dynamic secret engine", err)
	}

	return engine, nil
}

func (uc *createEngineUseCase) validateCreateRequest(req *sdk.CreateDynamicSecretEngineRequest) error {
	if req.Name == "" {
		return NewValidationError("engine name is required", ErrNameRequired)
	}
	if req.EngineType == "" {
		return NewValidationError("engine type is required", ErrEngineTypeRequired)
	}
	return nil
}
