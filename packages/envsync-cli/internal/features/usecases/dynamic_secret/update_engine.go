package dynamic_secret

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type updateEngineUseCase struct {
	dynamicSecretService services.DynamicSecretService
}

func NewUpdateEngineUseCase() UpdateEngineUseCase {
	return &updateEngineUseCase{
		dynamicSecretService: services.NewDynamicSecretService(),
	}
}

func (uc *updateEngineUseCase) Execute(ctx context.Context, id string, req *sdk.UpdateDynamicSecretEngineRequest) (result *sdk.DynamicSecretEngineResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "dynamic_secret.update_engine", trace.WithAttributes(attribute.String("engine.id", id)))
	defer end(&err)

	if id == "" {
		return nil, NewValidationError("engine ID is required", ErrIDRequired)
	}

	engine, err := uc.dynamicSecretService.UpdateEngine(ctx, id, req)
	if err != nil {
		return nil, NewServiceError("failed to update dynamic secret engine", err)
	}

	return engine, nil
}
