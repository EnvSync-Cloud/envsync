package rotation

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

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

func (uc *revokeExpiredCredentialsUseCase) Execute(ctx context.Context) (resp *sdk.RevokeOldCredentialResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "rotation.revoke-expired")
	defer end(&err)

	result, err := uc.rotationService.RevokeExpiredCredentials(ctx)
	if err != nil {
		return nil, NewServiceError("failed to revoke expired credentials", err)
	}

	return result, nil
}
