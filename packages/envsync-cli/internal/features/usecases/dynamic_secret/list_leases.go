package dynamic_secret

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

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

func (uc *listLeasesUseCase) Execute(ctx context.Context, engineID string) (sdk.DynamicSecretLeasesResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "dynamic_secret.list_leases")
	defer span.End()

	if engineID == "" {
		return nil, NewValidationError("engine ID is required", ErrEngineIDRequired)
	}

	leases, err := uc.dynamicSecretService.ListLeases(ctx, engineID)
	if err != nil {
		return nil, NewServiceError("failed to list dynamic secret leases", err)
	}

	return leases, nil
}
