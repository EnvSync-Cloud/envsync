package rotation

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type getPolicyUseCase struct {
	rotationService services.RotationService
}

func NewGetPolicyUseCase() GetPolicyUseCase {
	return &getPolicyUseCase{
		rotationService: services.NewRotationService(),
	}
}

func (uc *getPolicyUseCase) Execute(ctx context.Context, id string) (result *sdk.RotationPolicyResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "rotation.get",
		trace.WithAttributes(attribute.String("rotation.id", id)))
	defer end(&err)

	if id == "" {
		return nil, NewValidationError("rotation policy ID is required", ErrIDRequired)
	}

	policy, err := uc.rotationService.GetPolicy(ctx, id)
	if err != nil {
		return nil, NewServiceError("failed to get rotation policy", err)
	}

	return policy, nil
}
