package rotation

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type updatePolicyUseCase struct {
	rotationService services.RotationService
}

func NewUpdatePolicyUseCase() UpdatePolicyUseCase {
	return &updatePolicyUseCase{
		rotationService: services.NewRotationService(),
	}
}

func (uc *updatePolicyUseCase) Execute(ctx context.Context, id string, req *sdk.UpdateRotationPolicyRequest) (result *sdk.RotationPolicyResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "rotation.update",
		trace.WithAttributes(attribute.String("rotation.id", id)))
	defer end(&err)

	if id == "" {
		return nil, NewValidationError("rotation policy ID is required", ErrIDRequired)
	}

	policy, err := uc.rotationService.UpdatePolicy(ctx, id, req)
	if err != nil {
		return nil, NewServiceError("failed to update rotation policy", err)
	}

	return policy, nil
}
