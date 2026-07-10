package dynamic_secret

import (
	"context"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type cleanupUseCase struct {
	dynamicSecretService services.DynamicSecretService
}

func NewCleanupUseCase() CleanupUseCase {
	return &cleanupUseCase{
		dynamicSecretService: services.NewDynamicSecretService(),
	}
}

func (uc *cleanupUseCase) Execute(ctx context.Context) (*sdk.CleanupResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "dynamic_secret.cleanup")
	defer span.End()

	result, err := uc.dynamicSecretService.CleanupExpiredLeases(ctx)
	if err != nil {
		return nil, NewServiceError("failed to cleanup expired leases", err)
	}

	return result, nil
}
