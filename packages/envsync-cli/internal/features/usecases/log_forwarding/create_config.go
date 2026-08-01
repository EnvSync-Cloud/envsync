package log_forwarding

import (
	"context"
	"fmt"
	"strings"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type createLogForwardingConfigUseCase struct {
	service services.LogForwardingService
}

func NewCreateLogForwardingConfigUseCase() CreateLogForwardingConfigUseCase {
	return &createLogForwardingConfigUseCase{
		service: services.NewLogForwardingService(),
	}
}

func (uc *createLogForwardingConfigUseCase) Execute(
	ctx context.Context,
	name, providerType, endpointURL, apiKey string,
	enabled bool,
) (*sdk.LogForwardingResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "log_forwarding.create")
	defer span.End()

	// Validate inputs
	if err := uc.validateInputs(name, providerType, endpointURL, apiKey); err != nil {
		return nil, err
	}

	// Build the SDK request
	req := &sdk.CreateLogForwardingRequest{
		Name:         name,
		ProviderType: sdk.CreateLogForwardingRequestProviderType(providerType),
		Config: map[string]interface{}{
			"endpoint_url": endpointURL,
			"api_key":     apiKey,
		},
		Enabled: &enabled,
	}

	// Create via service
	resp, err := uc.service.CreateLogForwardingConfig(ctx, req)
	if err != nil {
		return nil, NewServiceError("failed to create log forwarding config", err)
	}

	return resp, nil
}

func (uc *createLogForwardingConfigUseCase) validateInputs(name, providerType, endpointURL, apiKey string) error {
	if strings.TrimSpace(name) == "" {
		return NewValidationError("config name is required", ErrConfigNameRequired)
	}

	if strings.TrimSpace(providerType) == "" {
		return NewValidationError("target (provider type) is required", ErrTargetRequired)
	}

	// Validate provider type
	validTargets := map[string]bool{
		"datadog":    true,
		"splunk":     true,
		"sumo-logic": true,
	}
	if !validTargets[providerType] {
		return NewValidationError(
			fmt.Sprintf("invalid target '%s'. Must be one of: datadog, splunk, sumo-logic", providerType),
			ErrInvalidTarget,
		)
	}

	if strings.TrimSpace(endpointURL) == "" {
		return NewValidationError("endpoint URL is required", ErrEndpointURLRequired)
	}

	if strings.TrimSpace(apiKey) == "" {
		return NewValidationError("API key is required", ErrAPIKeyRequired)
	}

	return nil
}
