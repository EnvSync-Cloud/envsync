package rotation

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type createPolicyUseCase struct {
	rotationService services.RotationService
}

func NewCreatePolicyUseCase() CreatePolicyUseCase {
	return &createPolicyUseCase{
		rotationService: services.NewRotationService(),
	}
}

func (uc *createPolicyUseCase) Execute(ctx context.Context, req *sdk.CreateRotationPolicyRequest) (result *sdk.RotationPolicyResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "rotation.create",
		trace.WithAttributes(
			attribute.String("app.id", req.AppId),
			attribute.String("env.id", req.EnvTypeId),
			attribute.String("variable.key", req.VariableKey),
		))
	defer end(&err)

	if err := uc.validateCreateRequest(req); err != nil {
		return nil, err
	}

	policy, err := uc.rotationService.CreatePolicy(ctx, req)
	if err != nil {
		return nil, NewServiceError("failed to create rotation policy", err)
	}

	return policy, nil
}

func (uc *createPolicyUseCase) validateCreateRequest(req *sdk.CreateRotationPolicyRequest) error {
	if req.AppId == "" {
		return NewValidationError("app_id is required", ErrSecretIDRequired)
	}
	if req.EnvTypeId == "" {
		return NewValidationError("env_type_id is required", ErrSecretIDRequired)
	}
	if req.VariableKey == "" {
		return NewValidationError("variable_key is required", ErrSecretIDRequired)
	}
	if req.EngineType == "" {
		return NewValidationError("engine_type is required", ErrEngineRequired)
	}
	if req.ScheduleCron == "" {
		return NewValidationError("schedule_cron is required", ErrScheduleRequired)
	}
	return nil
}
