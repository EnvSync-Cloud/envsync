package log_forwarding

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
)

// CreateLogForwardingConfigUseCase defines the interface for creating log forwarding configs
type CreateLogForwardingConfigUseCase interface {
	Execute(ctx context.Context, name, providerType, endpointURL, apiKey string, enabled bool) (*sdk.LogForwardingResponse, error)
}

// ListLogForwardingConfigsUseCase defines the interface for listing log forwarding configs
type ListLogForwardingConfigsUseCase interface {
	Execute(ctx context.Context) (sdk.LogForwardingsResponse, error)
}

// GetLogForwardingConfigUseCase defines the interface for getting a single log forwarding config
type GetLogForwardingConfigUseCase interface {
	Execute(ctx context.Context, id string) (*sdk.LogForwardingResponse, error)
}

// DeleteLogForwardingConfigUseCase defines the interface for deleting a log forwarding config
type DeleteLogForwardingConfigUseCase interface {
	Execute(ctx context.Context, id string) (*sdk.ErrorResponse, error)
}
