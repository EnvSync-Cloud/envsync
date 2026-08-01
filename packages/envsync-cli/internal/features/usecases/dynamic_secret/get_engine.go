package dynamic_secret

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type getEngineUseCase struct {
	dynamicSecretService services.DynamicSecretService
}

func NewGetEngineUseCase() GetEngineUseCase {
	return &getEngineUseCase{
		dynamicSecretService: services.NewDynamicSecretService(),
	}
}

func (uc *getEngineUseCase) Execute(ctx context.Context, id string) (*sdk.DynamicSecretEngineResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "dynamic_secret.get_engine")
	defer span.End()

	if id == "" {
		return nil, NewValidationError("engine ID is required", ErrIDRequired)
	}

	engine, err := uc.dynamicSecretService.GetEngine(ctx, id)
	if err != nil {
		return nil, NewServiceError("failed to get dynamic secret engine", err)
	}

	return engine, nil
}
