package dynamic_secret

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type getLeaseUseCase struct {
	dynamicSecretService services.DynamicSecretService
}

func NewGetLeaseUseCase() GetLeaseUseCase {
	return &getLeaseUseCase{
		dynamicSecretService: services.NewDynamicSecretService(),
	}
}

func (uc *getLeaseUseCase) Execute(ctx context.Context, leaseID string) (*sdk.DynamicSecretLeaseResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "dynamic_secret.get_lease")
	defer span.End()

	if leaseID == "" {
		return nil, NewValidationError("lease ID is required", ErrIDRequired)
	}

	lease, err := uc.dynamicSecretService.GetLease(ctx, leaseID)
	if err != nil {
		return nil, NewServiceError("failed to get dynamic secret lease", err)
	}

	return lease, nil
}
