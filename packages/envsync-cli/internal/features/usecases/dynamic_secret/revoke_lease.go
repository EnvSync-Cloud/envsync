package dynamic_secret

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

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

func (uc *revokeLeaseUseCase) Execute(ctx context.Context, leaseID string) (response *sdk.RevokeLeaseResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "dynamic_secret.revoke_lease", trace.WithAttributes(attribute.String("lease.id", leaseID)))
	defer end(&err)

	if leaseID == "" {
		return nil, NewValidationError("lease ID is required", ErrIDRequired)
	}

	result, err := uc.dynamicSecretService.RevokeLease(ctx, leaseID)
	if err != nil {
		return nil, NewServiceError("failed to revoke dynamic secret lease", err)
	}

	return result, nil
}
