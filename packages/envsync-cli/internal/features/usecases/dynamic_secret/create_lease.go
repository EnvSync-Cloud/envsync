package dynamic_secret

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

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

func (uc *createLeaseUseCase) Execute(ctx context.Context, engineID string, req *sdk.CreateDynamicSecretLeaseRequest) (*sdk.DynamicSecretLeaseResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "dynamic_secret.create_lease")
	defer span.End()

	if engineID == "" {
		return nil, NewValidationError("engine ID is required", ErrEngineIDRequired)
	}

	lease, err := uc.dynamicSecretService.CreateLease(ctx, engineID, req)
	if err != nil {
		return nil, NewServiceError("failed to create dynamic secret lease", err)
	}

	return lease, nil
}
