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

type getLogForwardingConfigUseCase struct {
	service services.LogForwardingService
}

func NewGetLogForwardingConfigUseCase() GetLogForwardingConfigUseCase {
	return &getLogForwardingConfigUseCase{
		service: services.NewLogForwardingService(),
	}
}

func (uc *getLogForwardingConfigUseCase) Execute(ctx context.Context, id string) (result *sdk.LogForwardingResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "log_forwarding.get", trace.WithAttributes(attribute.String("config.id", id)))
	defer end(&err)

	if strings.TrimSpace(id) == "" {
		return nil, NewValidationError("config ID is required", ErrConfigIDRequired)
	}

	config, err := uc.service.GetLogForwardingConfig(ctx, id)
	if err != nil {
		return nil, NewServiceError("failed to get log forwarding config", err)
	}

	return config, nil
}
