package log_forwarding

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type listLogForwardingConfigsUseCase struct {
	service services.LogForwardingService
}

func NewListLogForwardingConfigsUseCase() ListLogForwardingConfigsUseCase {
	return &listLogForwardingConfigsUseCase{
		service: services.NewLogForwardingService(),
	}
}

func (uc *listLogForwardingConfigsUseCase) Execute(ctx context.Context) (result sdk.LogForwardingsResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "log_forwarding.list")
	defer end(&err)

	configs, err := uc.service.GetLogForwardingConfigs(ctx)
	if err != nil {
		return nil, NewServiceError("failed to list log forwarding configs", err)
	}

	return configs, nil
}
