package dynamic_secret

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

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

func (uc *getEngineUseCase) Execute(ctx context.Context, id string) (result *sdk.DynamicSecretEngineResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "dynamic_secret.get_engine", trace.WithAttributes(attribute.String("engine.id", id)))
	defer end(&err)

	if id == "" {
		return nil, NewValidationError("engine ID is required", ErrIDRequired)
	}

	engine, err := uc.dynamicSecretService.GetEngine(ctx, id)
	if err != nil {
		return nil, NewServiceError("failed to get dynamic secret engine", err)
	}

	return engine, nil
}
