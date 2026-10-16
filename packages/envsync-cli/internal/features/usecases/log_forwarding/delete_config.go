package log_forwarding

import (
	"context"
	"strings"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
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

func (uc *deleteLogForwardingConfigUseCase) Execute(ctx context.Context, id string) (result *sdk.ErrorResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "log_forwarding.delete", trace.WithAttributes(attribute.String("config.id", id)))
	defer end(&err)

	if strings.TrimSpace(id) == "" {
		return nil, NewValidationError("config ID is required", ErrConfigIDRequired)
	}

	resp, err := uc.service.DeleteLogForwardingConfig(ctx, id)
	if err != nil {
		return nil, NewServiceError("failed to delete log forwarding config", err)
	}

	return resp, nil
}
