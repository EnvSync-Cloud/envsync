package log_forwarding

import (
	"context"
	"errors"
	"testing"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
)

// mockLogForwardingService implements services.LogForwardingService for testing.
type mockLogForwardingService struct {
	createResp *sdk.LogForwardingResponse
	createErr  error

	listResp sdk.LogForwardingsResponse
	listErr  error

	getResp *sdk.LogForwardingResponse
	getErr  error

	deleteResp *sdk.ErrorResponse
	deleteErr  error
}

var _ services.LogForwardingService = (*mockLogForwardingService)(nil)

func (m *mockLogForwardingService) CreateLogForwardingConfig(_ context.Context, _ *sdk.CreateLogForwardingRequest) (*sdk.LogForwardingResponse, error) {
	return m.createResp, m.createErr
}

func (m *mockLogForwardingService) GetLogForwardingConfigs(_ context.Context) (sdk.LogForwardingsResponse, error) {
	return m.listResp, m.listErr
}

func (m *mockLogForwardingService) GetLogForwardingConfig(_ context.Context, _ string) (*sdk.LogForwardingResponse, error) {
	return m.getResp, m.getErr
}

func (m *mockLogForwardingService) DeleteLogForwardingConfig(_ context.Context, _ string) (*sdk.ErrorResponse, error) {
	return m.deleteResp, m.deleteErr
}

// --- CreateLogForwardingConfigUseCase tests ---

func TestCreateLogForwardingConfigUseCase_EmptyName(t *testing.T) {
	mock := &mockLogForwardingService{}
	uc := &createLogForwardingConfigUseCase{service: mock}

	tests := []struct {
		name      string
		inputName string
	}{
		{name: "empty string", inputName: ""},
		{name: "whitespace only", inputName: "   "},
		{name: "tab only", inputName: "\t"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := uc.Execute(context.Background(), tt.inputName, "datadog", "https://example.com", "key123", true)
			if err == nil {
				t.Fatal("expected error for empty name, got nil")
			}
			if resp != nil {
				t.Errorf("expected nil response, got %v", resp)
			}

			var lfErr *LogForwardingError
			if !errors.As(err, &lfErr) {
				t.Fatalf("expected *LogForwardingError, got %T", err)
			}
			if lfErr.Code != ErrorCodeValidation {
				t.Errorf("expected code %q, got %q", ErrorCodeValidation, lfErr.Code)
			}
			if !errors.Is(lfErr.Cause, ErrConfigNameRequired) {
				t.Errorf("expected cause ErrConfigNameRequired, got %v", lfErr.Cause)
			}
		})
	}
}

func TestCreateLogForwardingConfigUseCase_EmptyProviderType(t *testing.T) {
	mock := &mockLogForwardingService{}
	uc := &createLogForwardingConfigUseCase{service: mock}

	tests := []struct {
		name        string
		providerType string
	}{
		{name: "empty string", providerType: ""},
		{name: "whitespace only", providerType: "   "},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := uc.Execute(context.Background(), "my-config", tt.providerType, "https://example.com", "key123", true)
			if err == nil {
				t.Fatal("expected error for empty provider type, got nil")
			}
			if resp != nil {
				t.Errorf("expected nil response, got %v", resp)
			}

			var lfErr *LogForwardingError
			if !errors.As(err, &lfErr) {
				t.Fatalf("expected *LogForwardingError, got %T", err)
			}
			if lfErr.Code != ErrorCodeValidation {
				t.Errorf("expected code %q, got %q", ErrorCodeValidation, lfErr.Code)
			}
			if !errors.Is(lfErr.Cause, ErrTargetRequired) {
				t.Errorf("expected cause ErrTargetRequired, got %v", lfErr.Cause)
			}
		})
	}
}

func TestCreateLogForwardingConfigUseCase_InvalidProviderType(t *testing.T) {
	mock := &mockLogForwardingService{}
	uc := &createLogForwardingConfigUseCase{service: mock}

	tests := []struct {
		name         string
		providerType string
	}{
		{name: "unknown provider", providerType: "unknown"},
		{name: "datadog typo", providerType: "Datadog"},
		{name: "splunk typo", providerType: "SPLUNK"},
		{name: "empty_map_provider", providerType: "newrelic"},
		{name: "numeric_string", providerType: "123"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := uc.Execute(context.Background(), "my-config", tt.providerType, "https://example.com", "key123", true)
			if err == nil {
				t.Fatalf("expected error for invalid provider type %q, got nil", tt.providerType)
			}
			if resp != nil {
				t.Errorf("expected nil response, got %v", resp)
			}

			var lfErr *LogForwardingError
			if !errors.As(err, &lfErr) {
				t.Fatalf("expected *LogForwardingError, got %T", err)
			}
			if lfErr.Code != ErrorCodeValidation {
				t.Errorf("expected code %q, got %q", ErrorCodeValidation, lfErr.Code)
			}
			if !errors.Is(lfErr.Cause, ErrInvalidTarget) {
				t.Errorf("expected cause ErrInvalidTarget, got %v", lfErr.Cause)
			}
		})
	}
}

func TestCreateLogForwardingConfigUseCase_EmptyEndpointURL(t *testing.T) {
	mock := &mockLogForwardingService{}
	uc := &createLogForwardingConfigUseCase{service: mock}

	tests := []struct {
		name        string
		endpointURL string
	}{
		{name: "empty string", endpointURL: ""},
		{name: "whitespace only", endpointURL: "   "},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := uc.Execute(context.Background(), "my-config", "datadog", tt.endpointURL, "key123", true)
			if err == nil {
				t.Fatal("expected error for empty endpoint URL, got nil")
			}
			if resp != nil {
				t.Errorf("expected nil response, got %v", resp)
			}

			var lfErr *LogForwardingError
			if !errors.As(err, &lfErr) {
				t.Fatalf("expected *LogForwardingError, got %T", err)
			}
			if lfErr.Code != ErrorCodeValidation {
				t.Errorf("expected code %q, got %q", ErrorCodeValidation, lfErr.Code)
			}
			if !errors.Is(lfErr.Cause, ErrEndpointURLRequired) {
				t.Errorf("expected cause ErrEndpointURLRequired, got %v", lfErr.Cause)
			}
		})
	}
}

func TestCreateLogForwardingConfigUseCase_EmptyAPIKey(t *testing.T) {
	mock := &mockLogForwardingService{}
	uc := &createLogForwardingConfigUseCase{service: mock}

	tests := []struct {
		name   string
		apiKey string
	}{
		{name: "empty string", apiKey: ""},
		{name: "whitespace only", apiKey: "   "},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := uc.Execute(context.Background(), "my-config", "datadog", "https://example.com", tt.apiKey, true)
			if err == nil {
				t.Fatal("expected error for empty API key, got nil")
			}
			if resp != nil {
				t.Errorf("expected nil response, got %v", resp)
			}

			var lfErr *LogForwardingError
			if !errors.As(err, &lfErr) {
				t.Fatalf("expected *LogForwardingError, got %T", err)
			}
			if lfErr.Code != ErrorCodeValidation {
				t.Errorf("expected code %q, got %q", ErrorCodeValidation, lfErr.Code)
			}
			if !errors.Is(lfErr.Cause, ErrAPIKeyRequired) {
				t.Errorf("expected cause ErrAPIKeyRequired, got %v", lfErr.Cause)
			}
		})
	}
}

func TestCreateLogForwardingConfigUseCase_ServiceError(t *testing.T) {
	svcErr := errors.New("network timeout")
	mock := &mockLogForwardingService{
		createErr: svcErr,
	}
	uc := &createLogForwardingConfigUseCase{service: mock}

	tests := []struct {
		name         string
		providerType string
	}{
		{name: "datadog service error", providerType: "datadog"},
		{name: "splunk service error", providerType: "splunk"},
		{name: "sumo-logic service error", providerType: "sumo-logic"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := uc.Execute(context.Background(), "my-config", tt.providerType, "https://example.com", "key123", true)
			if err == nil {
				t.Fatal("expected error from service, got nil")
			}
			if resp != nil {
				t.Errorf("expected nil response, got %v", resp)
			}

			var lfErr *LogForwardingError
			if !errors.As(err, &lfErr) {
				t.Fatalf("expected *LogForwardingError, got %T", err)
			}
			if lfErr.Code != ErrorCodeServiceError {
				t.Errorf("expected code %q, got %q", ErrorCodeServiceError, lfErr.Code)
			}
			if !errors.Is(lfErr, svcErr) {
				t.Errorf("expected wrapped service error, got %v", err)
			}
		})
	}
}

func TestCreateLogForwardingConfigUseCase_Success(t *testing.T) {
	expectedResp := &sdk.LogForwardingResponse{
		Id:           "cfg-123",
		OrgId:        "org-456",
		Name:         "my-datadog",
		ProviderType: sdk.LogForwardingResponseProviderTypeDatadog,
		Enabled:      true,
		CreatedAt:    "2024-01-15T10:00:00Z",
		UpdatedAt:    "2024-01-15T10:00:00Z",
	}

	tests := []struct {
		name         string
		configName   string
		providerType string
		endpointURL  string
		apiKey       string
		enabled      bool
	}{
		{
			name:         "datadog enabled",
			configName:   "my-datadog",
			providerType: "datadog",
			endpointURL:  "https://http-intake.logs.datadoghq.com",
			apiKey:       "dd-key-123",
			enabled:      true,
		},
		{
			name:         "splunk disabled",
			configName:   "my-splunk",
			providerType: "splunk",
			endpointURL:  "https://splunk.example.com:8088",
			apiKey:       "splunk-token-456",
			enabled:      false,
		},
		{
			name:         "sumo-logic enabled",
			configName:   "my-sumo",
			providerType: "sumo-logic",
			endpointURL:  "https://endpoint.sumologic.com",
			apiKey:       "sumo-key-789",
			enabled:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := &mockLogForwardingService{
				createResp: expectedResp,
			}
			uc := &createLogForwardingConfigUseCase{service: mock}

			resp, err := uc.Execute(context.Background(), tt.configName, tt.providerType, tt.endpointURL, tt.apiKey, tt.enabled)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if resp == nil {
				t.Fatal("expected non-nil response")
			}
			if resp.Id != expectedResp.Id {
				t.Errorf("expected ID %q, got %q", expectedResp.Id, resp.Id)
			}
			if resp.Name != expectedResp.Name {
				t.Errorf("expected Name %q, got %q", expectedResp.Name, resp.Name)
			}
		})
	}
}

// --- ListLogForwardingConfigsUseCase tests ---

func TestListLogForwardingConfigsUseCase_ServiceError(t *testing.T) {
	svcErr := errors.New("connection refused")
	mock := &mockLogForwardingService{
		listErr: svcErr,
	}
	uc := &listLogForwardingConfigsUseCase{service: mock}

	resp, err := uc.Execute(context.Background())
	if err == nil {
		t.Fatal("expected error from service, got nil")
	}
	if resp != nil {
		t.Errorf("expected nil response, got %v", resp)
	}

	var lfErr *LogForwardingError
	if !errors.As(err, &lfErr) {
		t.Fatalf("expected *LogForwardingError, got %T", err)
	}
	if lfErr.Code != ErrorCodeServiceError {
		t.Errorf("expected code %q, got %q", ErrorCodeServiceError, lfErr.Code)
	}
	if !errors.Is(lfErr, svcErr) {
		t.Errorf("expected wrapped service error, got %v", err)
	}
}

func TestListLogForwardingConfigsUseCase_EmptyList(t *testing.T) {
	mock := &mockLogForwardingService{
		listResp: sdk.LogForwardingsResponse{},
	}
	uc := &listLogForwardingConfigsUseCase{service: mock}

	resp, err := uc.Execute(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp == nil {
		t.Fatal("expected non-nil response")
	}
	if len(resp) != 0 {
		t.Errorf("expected empty list, got %d items", len(resp))
	}
}

func TestListLogForwardingConfigsUseCase_Success(t *testing.T) {
	expectedConfigs := sdk.LogForwardingsResponse{
		&sdk.LogForwardingResponse{
			Id:           "cfg-1",
			Name:         "datadog-prod",
			ProviderType: sdk.LogForwardingResponseProviderTypeDatadog,
			Enabled:      true,
		},
		&sdk.LogForwardingResponse{
			Id:           "cfg-2",
			Name:         "splunk-staging",
			ProviderType: sdk.LogForwardingResponseProviderTypeSplunk,
			Enabled:      false,
		},
		&sdk.LogForwardingResponse{
			Id:           "cfg-3",
			Name:         "sumo-dev",
			ProviderType: sdk.LogForwardingResponseProviderTypeSumoLogic,
			Enabled:      true,
		},
	}

	mock := &mockLogForwardingService{
		listResp: expectedConfigs,
	}
	uc := &listLogForwardingConfigsUseCase{service: mock}

	resp, err := uc.Execute(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp == nil {
		t.Fatal("expected non-nil response")
	}
	if len(resp) != len(expectedConfigs) {
		t.Fatalf("expected %d configs, got %d", len(expectedConfigs), len(resp))
	}

	for i, cfg := range resp {
		if cfg.Id != expectedConfigs[i].Id {
			t.Errorf("config[%d]: expected ID %q, got %q", i, expectedConfigs[i].Id, cfg.Id)
		}
		if cfg.Name != expectedConfigs[i].Name {
			t.Errorf("config[%d]: expected Name %q, got %q", i, expectedConfigs[i].Name, cfg.Name)
		}
		if cfg.ProviderType != expectedConfigs[i].ProviderType {
			t.Errorf("config[%d]: expected ProviderType %q, got %q", i, expectedConfigs[i].ProviderType, cfg.ProviderType)
		}
		if cfg.Enabled != expectedConfigs[i].Enabled {
			t.Errorf("config[%d]: expected Enabled %v, got %v", i, expectedConfigs[i].Enabled, cfg.Enabled)
		}
	}
}

// --- GetLogForwardingConfigUseCase tests ---

func TestGetLogForwardingConfigUseCase_EmptyID(t *testing.T) {
	mock := &mockLogForwardingService{}
	uc := &getLogForwardingConfigUseCase{service: mock}

	tests := []struct {
		name string
		id   string
	}{
		{name: "empty string", id: ""},
		{name: "whitespace only", id: "   "},
		{name: "tab only", id: "\t"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := uc.Execute(context.Background(), tt.id)
			if err == nil {
				t.Fatal("expected error for empty ID, got nil")
			}
			if resp != nil {
				t.Errorf("expected nil response, got %v", resp)
			}

			var lfErr *LogForwardingError
			if !errors.As(err, &lfErr) {
				t.Fatalf("expected *LogForwardingError, got %T", err)
			}
			if lfErr.Code != ErrorCodeValidation {
				t.Errorf("expected code %q, got %q", ErrorCodeValidation, lfErr.Code)
			}
			if !errors.Is(lfErr.Cause, ErrConfigIDRequired) {
				t.Errorf("expected cause ErrConfigIDRequired, got %v", lfErr.Cause)
			}
		})
	}
}

func TestGetLogForwardingConfigUseCase_ServiceError(t *testing.T) {
	svcErr := errors.New("HTTP 500")
	mock := &mockLogForwardingService{
		getErr: svcErr,
	}
	uc := &getLogForwardingConfigUseCase{service: mock}

	resp, err := uc.Execute(context.Background(), "cfg-123")
	if err == nil {
		t.Fatal("expected error from service, got nil")
	}
	if resp != nil {
		t.Errorf("expected nil response, got %v", resp)
	}

	var lfErr *LogForwardingError
	if !errors.As(err, &lfErr) {
		t.Fatalf("expected *LogForwardingError, got %T", err)
	}
	if lfErr.Code != ErrorCodeServiceError {
		t.Errorf("expected code %q, got %q", ErrorCodeServiceError, lfErr.Code)
	}
	if !errors.Is(lfErr, svcErr) {
		t.Errorf("expected wrapped service error, got %v", err)
	}
}

func TestGetLogForwardingConfigUseCase_Success(t *testing.T) {
	expectedResp := &sdk.LogForwardingResponse{
		Id:           "cfg-abc",
		OrgId:        "org-xyz",
		Name:         "prod-datadog",
		ProviderType: sdk.LogForwardingResponseProviderTypeDatadog,
		Config:       map[string]interface{}{"endpoint_url": "https://example.com"},
		Enabled:      true,
		CreatedAt:    "2024-01-15T10:00:00Z",
		UpdatedAt:    "2024-01-16T12:00:00Z",
	}

	mock := &mockLogForwardingService{
		getResp: expectedResp,
	}
	uc := &getLogForwardingConfigUseCase{service: mock}

	resp, err := uc.Execute(context.Background(), "cfg-abc")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp == nil {
		t.Fatal("expected non-nil response")
	}
	if resp.Id != expectedResp.Id {
		t.Errorf("expected ID %q, got %q", expectedResp.Id, resp.Id)
	}
	if resp.Name != expectedResp.Name {
		t.Errorf("expected Name %q, got %q", expectedResp.Name, resp.Name)
	}
	if resp.OrgId != expectedResp.OrgId {
		t.Errorf("expected OrgId %q, got %q", expectedResp.OrgId, resp.OrgId)
	}
	if resp.ProviderType != expectedResp.ProviderType {
		t.Errorf("expected ProviderType %q, got %q", expectedResp.ProviderType, resp.ProviderType)
	}
	if resp.Enabled != expectedResp.Enabled {
		t.Errorf("expected Enabled %v, got %v", expectedResp.Enabled, resp.Enabled)
	}
}

// --- DeleteLogForwardingConfigUseCase tests ---

func TestDeleteLogForwardingConfigUseCase_EmptyID(t *testing.T) {
	mock := &mockLogForwardingService{}
	uc := &deleteLogForwardingConfigUseCase{service: mock}

	tests := []struct {
		name string
		id   string
	}{
		{name: "empty string", id: ""},
		{name: "whitespace only", id: "   "},
		{name: "tab only", id: "\t"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := uc.Execute(context.Background(), tt.id)
			if err == nil {
				t.Fatal("expected error for empty ID, got nil")
			}
			if resp != nil {
				t.Errorf("expected nil response, got %v", resp)
			}

			var lfErr *LogForwardingError
			if !errors.As(err, &lfErr) {
				t.Fatalf("expected *LogForwardingError, got %T", err)
			}
			if lfErr.Code != ErrorCodeValidation {
				t.Errorf("expected code %q, got %q", ErrorCodeValidation, lfErr.Code)
			}
			if !errors.Is(lfErr.Cause, ErrConfigIDRequired) {
				t.Errorf("expected cause ErrConfigIDRequired, got %v", lfErr.Cause)
			}
		})
	}
}

func TestDeleteLogForwardingConfigUseCase_ServiceError(t *testing.T) {
	svcErr := errors.New("timeout")
	mock := &mockLogForwardingService{
		deleteErr: svcErr,
	}
	uc := &deleteLogForwardingConfigUseCase{service: mock}

	resp, err := uc.Execute(context.Background(), "cfg-123")
	if err == nil {
		t.Fatal("expected error from service, got nil")
	}
	if resp != nil {
		t.Errorf("expected nil response, got %v", resp)
	}

	var lfErr *LogForwardingError
	if !errors.As(err, &lfErr) {
		t.Fatalf("expected *LogForwardingError, got %T", err)
	}
	if lfErr.Code != ErrorCodeServiceError {
		t.Errorf("expected code %q, got %q", ErrorCodeServiceError, lfErr.Code)
	}
	if !errors.Is(lfErr, svcErr) {
		t.Errorf("expected wrapped service error, got %v", err)
	}
}

func TestDeleteLogForwardingConfigUseCase_Success(t *testing.T) {
	expectedResp := &sdk.ErrorResponse{
		Error: "log forwarding config deleted",
	}

	mock := &mockLogForwardingService{
		deleteResp: expectedResp,
	}
	uc := &deleteLogForwardingConfigUseCase{service: mock}

	resp, err := uc.Execute(context.Background(), "cfg-123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp == nil {
		t.Fatal("expected non-nil response")
	}
	if resp.GetError() != expectedResp.GetError() {
		t.Errorf("expected error message %q, got %q", expectedResp.GetError(), resp.GetError())
	}
}

// --- Error type tests ---

func TestLogForwardingError_Error(t *testing.T) {
	tests := []struct {
		name     string
		err      *LogForwardingError
		expected string
	}{
		{
			name: "without cause",
			err: &LogForwardingError{
				Code:    ErrorCodeValidation,
				Message: "name is required",
			},
			expected: "name is required",
		},
		{
			name: "with cause",
			err: &LogForwardingError{
				Code:    ErrorCodeServiceError,
				Message: "failed to create",
				Cause:   errors.New("network error"),
			},
			expected: "failed to create: network error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.err.Error()
			if result != tt.expected {
				t.Errorf("expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestLogForwardingError_Unwrap(t *testing.T) {
	cause := errors.New("root cause")
	lfErr := &LogForwardingError{
		Code:    ErrorCodeServiceError,
		Message: "wrapped",
		Cause:   cause,
	}

	if !errors.Is(lfErr, cause) {
		t.Error("expected Unwrap to return the cause")
	}

	// nil cause
	lfErrNoCause := &LogForwardingError{
		Code:    ErrorCodeValidation,
		Message: "no cause",
	}
	if lfErrNoCause.Unwrap() != nil {
		t.Error("expected nil from Unwrap when cause is nil")
	}
}

func TestNewValidationError(t *testing.T) {
	cause := ErrConfigNameRequired
	err := NewValidationError("name is required", cause)

	if err.Code != ErrorCodeValidation {
		t.Errorf("expected code %q, got %q", ErrorCodeValidation, err.Code)
	}
	if err.Message != "name is required" {
		t.Errorf("expected message %q, got %q", "name is required", err.Message)
	}
	if err.Cause != cause {
		t.Errorf("expected cause %v, got %v", cause, err.Cause)
	}
}

func TestNewNotFoundError(t *testing.T) {
	cause := ErrConfigNotFound
	err := NewNotFoundError("config not found", cause)

	if err.Code != ErrorCodeNotFound {
		t.Errorf("expected code %q, got %q", ErrorCodeNotFound, err.Code)
	}
	if err.Cause != cause {
		t.Errorf("expected cause %v, got %v", cause, err.Cause)
	}
}

func TestNewServiceError(t *testing.T) {
	cause := errors.New("connection refused")
	err := NewServiceError("service unavailable", cause)

	if err.Code != ErrorCodeServiceError {
		t.Errorf("expected code %q, got %q", ErrorCodeServiceError, err.Code)
	}
	if err.Cause != cause {
		t.Errorf("expected cause %v, got %v", cause, err.Cause)
	}
}
