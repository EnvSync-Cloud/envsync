package dynamic_secret

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type listEnginesUseCase struct {
	dynamicSecretService services.DynamicSecretService
}

func NewListEnginesUseCase() ListEnginesUseCase {
	return &listEnginesUseCase{
		dynamicSecretService: services.NewDynamicSecretService(),
	}
}

func (uc *listEnginesUseCase) Execute(ctx context.Context) (result sdk.DynamicSecretEnginesResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "dynamic_secret.list_engines")
	defer end(&err)

	engines, err := uc.dynamicSecretService.ListEngines(ctx)
	if err != nil {
		return nil, NewServiceError("failed to list dynamic secret engines", err)
	}

	return engines, nil
}
