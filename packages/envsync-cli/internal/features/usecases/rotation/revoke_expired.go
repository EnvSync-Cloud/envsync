package rotation

import (
	"context"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type revokeExpiredCredentialsUseCase struct {
	rotationService services.RotationService
}

func NewRevokeExpiredCredentialsUseCase() RevokeExpiredCredentialsUseCase {
	return &revokeExpiredCredentialsUseCase{
		rotationService: services.NewRotationService(),
	}
}

func (uc *revokeExpiredCredentialsUseCase) Execute(ctx context.Context) (*sdk.RevokeOldCredentialResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "rotation.revoke-expired")
	defer span.End()

	result, err := uc.rotationService.RevokeExpiredCredentials(ctx)
	if err != nil {
		return nil, NewServiceError("failed to revoke expired credentials", err)
	}

	return result, nil
}
