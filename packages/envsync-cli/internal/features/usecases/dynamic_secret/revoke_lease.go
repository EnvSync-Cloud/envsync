package dynamic_secret

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type revokeLeaseUseCase struct {
	dynamicSecretService services.DynamicSecretService
}

func NewRevokeLeaseUseCase() RevokeLeaseUseCase {
	return &revokeLeaseUseCase{
		dynamicSecretService: services.NewDynamicSecretService(),
	}
}

func (uc *revokeLeaseUseCase) Execute(ctx context.Context, leaseID string) (*sdk.RevokeLeaseResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "dynamic_secret.revoke_lease")
	defer span.End()

	if leaseID == "" {
		return nil, NewValidationError("lease ID is required", ErrIDRequired)
	}

	result, err := uc.dynamicSecretService.RevokeLease(ctx, leaseID)
	if err != nil {
		return nil, NewServiceError("failed to revoke dynamic secret lease", err)
	}

	return result, nil
}
