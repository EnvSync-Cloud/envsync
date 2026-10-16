package dynamic_secret

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type createLeaseUseCase struct {
	dynamicSecretService services.DynamicSecretService
}

func NewCreateLeaseUseCase() CreateLeaseUseCase {
	return &createLeaseUseCase{
		dynamicSecretService: services.NewDynamicSecretService(),
	}
}

func (uc *createLeaseUseCase) Execute(ctx context.Context, engineID string, req *sdk.CreateDynamicSecretLeaseRequest) (result *sdk.DynamicSecretLeaseResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "dynamic_secret.create_lease", trace.WithAttributes(
		attribute.String("engine.id", engineID),
		attribute.String("app.id", req.AppId),
		attribute.String("env.id", req.EnvTypeId),
		attribute.String("config.key", req.VariableKey),
	))
	defer end(&err)

	if engineID == "" {
		return nil, NewValidationError("engine ID is required", ErrEngineIDRequired)
	}

	lease, err := uc.dynamicSecretService.CreateLease(ctx, engineID, req)
	if err != nil {
		return nil, NewServiceError("failed to create dynamic secret lease", err)
	}

	return lease, nil
}
