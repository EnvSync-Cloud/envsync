package services

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
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

func (s *logForwardingService) CreateLogForwardingConfig(ctx context.Context, req *sdk.CreateLogForwardingRequest) (*sdk.LogForwardingResponse, error) {
	client := repository.CreateManagementSDKClient()
	return client.LogForwarding.CreateLogForwardingConfig(ctx, req)
}

func (s *logForwardingService) GetLogForwardingConfigs(ctx context.Context) (sdk.LogForwardingsResponse, error) {
	client := repository.CreateManagementSDKClient()
	return client.LogForwarding.GetLogForwardingConfigs(ctx)
}

func (s *logForwardingService) GetLogForwardingConfig(ctx context.Context, id string) (*sdk.LogForwardingResponse, error) {
	client := repository.CreateManagementSDKClient()
	return client.LogForwarding.GetLogForwardingConfig(ctx, id)
}

func (s *logForwardingService) DeleteLogForwardingConfig(ctx context.Context, id string) (*sdk.ErrorResponse, error) {
	client := repository.CreateManagementSDKClient()
	return client.LogForwarding.DeleteLogForwardingConfig(ctx, id)
}
