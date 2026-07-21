package log_forwarding

import (
	"context"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"
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

func (uc *listLogForwardingConfigsUseCase) Execute(ctx context.Context) (sdk.LogForwardingsResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "log_forwarding.list")
	defer span.End()

	configs, err := uc.service.GetLogForwardingConfigs(ctx)
	if err != nil {
		return nil, NewServiceError("failed to list log forwarding configs", err)
	}

	return configs, nil
}
