package log_forwarding

import (
	"context"
	"strings"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type deleteLogForwardingConfigUseCase struct {
	service services.LogForwardingService
}

func NewDeleteLogForwardingConfigUseCase() DeleteLogForwardingConfigUseCase {
	return &deleteLogForwardingConfigUseCase{
		service: services.NewLogForwardingService(),
	}
}

func (uc *deleteLogForwardingConfigUseCase) Execute(ctx context.Context, id string) (*sdk.ErrorResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "log_forwarding.delete")
	defer span.End()

	if strings.TrimSpace(id) == "" {
		return nil, NewValidationError("config ID is required", ErrConfigIDRequired)
	}

	resp, err := uc.service.DeleteLogForwardingConfig(ctx, id)
	if err != nil {
		return nil, NewServiceError("failed to delete log forwarding config", err)
	}

	return resp, nil
}
