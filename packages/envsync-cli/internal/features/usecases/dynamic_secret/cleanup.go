package dynamic_secret

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

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

func (uc *cleanupUseCase) Execute(ctx context.Context) (response *sdk.CleanupResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "dynamic_secret.cleanup")
	defer end(&err)

	result, err := uc.dynamicSecretService.CleanupExpiredLeases(ctx)
	if err != nil {
		return nil, NewServiceError("failed to cleanup expired leases", err)
	}

	return result, nil
}
