package services

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

// LogForwardingService defines the interface for log forwarding operations
type LogForwardingService interface {
	CreateLogForwardingConfig(ctx context.Context, req *sdk.CreateLogForwardingRequest) (*sdk.LogForwardingResponse, error)
	GetLogForwardingConfigs(ctx context.Context) (sdk.LogForwardingsResponse, error)
	GetLogForwardingConfig(ctx context.Context, id string) (*sdk.LogForwardingResponse, error)
	DeleteLogForwardingConfig(ctx context.Context, id string) (*sdk.ErrorResponse, error)
}

type logForwardingService struct{}

func NewLogForwardingService() LogForwardingService {
	return &logForwardingService{}
}

func (s *logForwardingService) CreateLogForwardingConfig(ctx context.Context, req *sdk.CreateLogForwardingRequest) (result *sdk.LogForwardingResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.log_forwarding.create_log_forwarding_config")
	defer end(&err)

	client := repository.CreateManagementSDKClient()
	return client.LogForwarding.CreateLogForwardingConfig(ctx, req)
}

func (s *logForwardingService) GetLogForwardingConfigs(ctx context.Context) (result sdk.LogForwardingsResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.log_forwarding.get_log_forwarding_configs")
	defer end(&err)

	client := repository.CreateManagementSDKClient()
	return client.LogForwarding.GetLogForwardingConfigs(ctx)
}

func (s *logForwardingService) GetLogForwardingConfig(ctx context.Context, id string) (result *sdk.LogForwardingResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.log_forwarding.get_log_forwarding_config")
	defer end(&err)

	client := repository.CreateManagementSDKClient()
	return client.LogForwarding.GetLogForwardingConfig(ctx, id)
}

func (s *logForwardingService) DeleteLogForwardingConfig(ctx context.Context, id string) (result *sdk.ErrorResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.log_forwarding.delete_log_forwarding_config")
	defer end(&err)

	client := repository.CreateManagementSDKClient()
	return client.LogForwarding.DeleteLogForwardingConfig(ctx, id)
}
