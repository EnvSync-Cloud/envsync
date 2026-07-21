package log_forwarding

import (
	"context"
	"strings"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type getLogForwardingConfigUseCase struct {
	service services.LogForwardingService
}

func NewGetLogForwardingConfigUseCase() GetLogForwardingConfigUseCase {
	return &getLogForwardingConfigUseCase{
		service: services.NewLogForwardingService(),
	}
}

func (uc *getLogForwardingConfigUseCase) Execute(ctx context.Context, id string) (*sdk.LogForwardingResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "log_forwarding.get")
	defer span.End()

	if strings.TrimSpace(id) == "" {
		return nil, NewValidationError("config ID is required", ErrConfigIDRequired)
	}

	config, err := uc.service.GetLogForwardingConfig(ctx, id)
	if err != nil {
		return nil, NewServiceError("failed to get log forwarding config", err)
	}

	return config, nil
}
