package rotation

import (
	"context"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type createPolicyUseCase struct {
	rotationService services.RotationService
}

func NewCreatePolicyUseCase() CreatePolicyUseCase {
	return &createPolicyUseCase{
		rotationService: services.NewRotationService(),
	}
}

func (uc *createPolicyUseCase) Execute(ctx context.Context, req *sdk.CreateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "rotation.create")
	defer span.End()

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
