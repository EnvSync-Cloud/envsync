package dynamic_secret

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type listLeasesUseCase struct {
	dynamicSecretService services.DynamicSecretService
}

func NewListLeasesUseCase() ListLeasesUseCase {
	return &listLeasesUseCase{
		dynamicSecretService: services.NewDynamicSecretService(),
	}
}

func (uc *listLeasesUseCase) Execute(ctx context.Context, engineID string) (result sdk.DynamicSecretLeasesResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "dynamic_secret.list_leases", trace.WithAttributes(attribute.String("engine.id", engineID)))
	defer end(&err)

	if engineID == "" {
		return nil, NewValidationError("engine ID is required", ErrEngineIDRequired)
	}

	leases, err := uc.dynamicSecretService.ListLeases(ctx, engineID)
	if err != nil {
		return nil, NewServiceError("failed to list dynamic secret leases", err)
	}

	return leases, nil
}
