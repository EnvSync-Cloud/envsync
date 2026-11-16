package rotation

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type listPoliciesUseCase struct {
	rotationService services.RotationService
}

func NewListPoliciesUseCase() ListPoliciesUseCase {
	return &listPoliciesUseCase{
		rotationService: services.NewRotationService(),
	}
}

func (uc *listPoliciesUseCase) Execute(ctx context.Context, req *sdk.GetRotationPoliciesRequest) (result sdk.RotationPoliciesResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "rotation.list")
	defer end(&err)

	policies, err := uc.rotationService.ListPolicies(ctx, req)
	if err != nil {
		return nil, NewServiceError("failed to list rotation policies", err)
	}

	return policies, nil
}
