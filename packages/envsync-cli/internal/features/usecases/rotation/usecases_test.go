package rotation

import (
	"context"
	"errors"
	"testing"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"
)

// mockRotationService implements services.RotationService for testing.
type mockRotationService struct {
	listPoliciesFn         func(ctx context.Context, req *sdk.GetRotationPoliciesRequest) (sdk.RotationPoliciesResponse, error)
	createPolicyFn         func(ctx context.Context, req *sdk.CreateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error)
	getPolicyFn            func(ctx context.Context, id string) (*sdk.RotationPolicyResponse, error)
	deletePolicyFn         func(ctx context.Context, id string) (*sdk.ErrorResponse, error)
	updatePolicyFn         func(ctx context.Context, id string, req *sdk.UpdateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error)
	triggerRotationFn      func(ctx context.Context, id string) (*sdk.TriggerRotationResponse, error)
	getRotationStatesFn    func(ctx context.Context, id string) (sdk.RotationStatesResponse, error)
	revokeExpiredCredsFn   func(ctx context.Context) (*sdk.RevokeOldCredentialResponse, error)
}

func (m *mockRotationService) ListPolicies(ctx context.Context, req *sdk.GetRotationPoliciesRequest) (sdk.RotationPoliciesResponse, error) {
	return m.listPoliciesFn(ctx, req)
}

func (m *mockRotationService) CreatePolicy(ctx context.Context, req *sdk.CreateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error) {
	return m.createPolicyFn(ctx, req)
}

func (m *mockRotationService) GetPolicy(ctx context.Context, id string) (*sdk.RotationPolicyResponse, error) {
	return m.getPolicyFn(ctx, id)
}

func (m *mockRotationService) DeletePolicy(ctx context.Context, id string) (*sdk.ErrorResponse, error) {
	return m.deletePolicyFn(ctx, id)
}

func (m *mockRotationService) UpdatePolicy(ctx context.Context, id string, req *sdk.UpdateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error) {
	return m.updatePolicyFn(ctx, id, req)
}

func (m *mockRotationService) TriggerRotation(ctx context.Context, id string) (*sdk.TriggerRotationResponse, error) {
	return m.triggerRotationFn(ctx, id)
}

func (m *mockRotationService) GetRotationStates(ctx context.Context, id string) (sdk.RotationStatesResponse, error) {
	return m.getRotationStatesFn(ctx, id)
}

func (m *mockRotationService) RevokeExpiredCredentials(ctx context.Context) (*sdk.RevokeOldCredentialResponse, error) {
	return m.revokeExpiredCredsFn(ctx)
}

var errService = errors.New("service error")

// --- CreatePolicyUseCase ---

func TestCreatePolicyUseCase_Execute(t *testing.T) {
	validReq := &sdk.CreateRotationPolicyRequest{
		AppId:        "app-123",
		EnvTypeId:    "env-456",
		VariableKey:  "DB_PASSWORD",
		EngineType:   sdk.CreateRotationPolicyRequestEngineTypePostgres,
		ScheduleCron: "0 */6 * * *",
	}

	expectedResp := &sdk.RotationPolicyResponse{
		Id:           "policy-789",
		AppId:        "app-123",
		EnvTypeId:    "env-456",
		VariableKey:  "DB_PASSWORD",
		EngineType:   sdk.RotationPolicyResponseEngineTypePostgres,
		ScheduleCron: "0 */6 * * *",
		Enabled:      true,
	}

	tests := []struct {
		name        string
		req         *sdk.CreateRotationPolicyRequest
		mockFn      func(ctx context.Context, req *sdk.CreateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error)
		wantErr     bool
		wantErrCode string
		checkResp   func(t *testing.T, resp *sdk.RotationPolicyResponse)
	}{
		{
			name: "success",
			req:  validReq,
			mockFn: func(_ context.Context, _ *sdk.CreateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error) {
				return expectedResp, nil
			},
			wantErr: false,
			checkResp: func(t *testing.T, resp *sdk.RotationPolicyResponse) {
				if resp.Id != "policy-789" {
					t.Errorf("expected policy ID 'policy-789', got '%s'", resp.Id)
				}
				if resp.AppId != "app-123" {
					t.Errorf("expected app ID 'app-123', got '%s'", resp.AppId)
				}
			},
		},
		{
			name: "empty app_id returns validation error",
			req: &sdk.CreateRotationPolicyRequest{
				AppId:        "",
				EnvTypeId:    "env-456",
				VariableKey:  "DB_PASSWORD",
				EngineType:   sdk.CreateRotationPolicyRequestEngineTypePostgres,
				ScheduleCron: "0 */6 * * *",
			},
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: RotationErrorCodeValidation,
		},
		{
			name: "empty env_type_id returns validation error",
			req: &sdk.CreateRotationPolicyRequest{
				AppId:        "app-123",
				EnvTypeId:    "",
				VariableKey:  "DB_PASSWORD",
				EngineType:   sdk.CreateRotationPolicyRequestEngineTypePostgres,
				ScheduleCron: "0 */6 * * *",
			},
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: RotationErrorCodeValidation,
		},
		{
			name: "empty variable_key returns validation error",
			req: &sdk.CreateRotationPolicyRequest{
				AppId:        "app-123",
				EnvTypeId:    "env-456",
				VariableKey:  "",
				EngineType:   sdk.CreateRotationPolicyRequestEngineTypePostgres,
				ScheduleCron: "0 */6 * * *",
			},
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: RotationErrorCodeValidation,
		},
		{
			name: "empty engine_type returns validation error",
			req: &sdk.CreateRotationPolicyRequest{
				AppId:        "app-123",
				EnvTypeId:    "env-456",
				VariableKey:  "DB_PASSWORD",
				EngineType:   "",
				ScheduleCron: "0 */6 * * *",
			},
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: RotationErrorCodeValidation,
		},
		{
			name: "empty schedule_cron returns validation error",
			req: &sdk.CreateRotationPolicyRequest{
				AppId:        "app-123",
				EnvTypeId:    "env-456",
				VariableKey:  "DB_PASSWORD",
				EngineType:   sdk.CreateRotationPolicyRequestEngineTypePostgres,
				ScheduleCron: "",
			},
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: RotationErrorCodeValidation,
		},
		{
			name: "service error returns service error",
			req:  validReq,
			mockFn: func(_ context.Context, _ *sdk.CreateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error) {
				return nil, errService
			},
			wantErr:     true,
			wantErrCode: RotationErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &createPolicyUseCase{
				rotationService: &mockRotationService{
					createPolicyFn: tt.mockFn,
				},
			}

			resp, err := uc.Execute(context.Background(), tt.req)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var rotErr *RotationError
				if !errors.As(err, &rotErr) {
					t.Fatalf("expected *RotationError, got %T", err)
				}
				if rotErr.Code != tt.wantErrCode {
					t.Errorf("expected error code '%s', got '%s'", tt.wantErrCode, rotErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if resp == nil {
				t.Fatal("expected non-nil response")
			}
			if tt.checkResp != nil {
				tt.checkResp(t, resp)
			}
		})
	}
}

// --- ListPoliciesUseCase ---

func TestListPoliciesUseCase_Execute(t *testing.T) {
	expectedPolicies := sdk.RotationPoliciesResponse{
		&sdk.RotationPolicyResponse{Id: "p1", AppId: "a1"},
		&sdk.RotationPolicyResponse{Id: "p2", AppId: "a2"},
	}

	tests := []struct {
		name      string
		mockFn    func(ctx context.Context, req *sdk.GetRotationPoliciesRequest) (sdk.RotationPoliciesResponse, error)
		wantErr   bool
		wantCount int
	}{
		{
			name: "success with results",
			mockFn: func(_ context.Context, _ *sdk.GetRotationPoliciesRequest) (sdk.RotationPoliciesResponse, error) {
				return expectedPolicies, nil
			},
			wantErr:   false,
			wantCount: 2,
		},
		{
			name: "success with empty list",
			mockFn: func(_ context.Context, _ *sdk.GetRotationPoliciesRequest) (sdk.RotationPoliciesResponse, error) {
				return sdk.RotationPoliciesResponse{}, nil
			},
			wantErr:   false,
			wantCount: 0,
		},
		{
			name: "service error",
			mockFn: func(_ context.Context, _ *sdk.GetRotationPoliciesRequest) (sdk.RotationPoliciesResponse, error) {
				return nil, errService
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &listPoliciesUseCase{
				rotationService: &mockRotationService{
					listPoliciesFn: tt.mockFn,
				},
			}

			resp, err := uc.Execute(context.Background(), &sdk.GetRotationPoliciesRequest{})

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var rotErr *RotationError
				if !errors.As(err, &rotErr) {
					t.Fatalf("expected *RotationError, got %T", err)
				}
				if rotErr.Code != RotationErrorCodeServiceError {
					t.Errorf("expected error code '%s', got '%s'", RotationErrorCodeServiceError, rotErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(resp) != tt.wantCount {
				t.Errorf("expected %d policies, got %d", tt.wantCount, len(resp))
			}
		})
	}
}

// --- GetPolicyUseCase ---

func TestGetPolicyUseCase_Execute(t *testing.T) {
	expectedPolicy := &sdk.RotationPolicyResponse{
		Id:    "policy-123",
		AppId: "app-456",
	}

	tests := []struct {
		name        string
		id          string
		mockFn      func(ctx context.Context, id string) (*sdk.RotationPolicyResponse, error)
		wantErr     bool
		wantErrCode string
	}{
		{
			name: "success",
			id:   "policy-123",
			mockFn: func(_ context.Context, id string) (*sdk.RotationPolicyResponse, error) {
				if id != "policy-123" {
					t.Errorf("expected ID 'policy-123', got '%s'", id)
				}
				return expectedPolicy, nil
			},
			wantErr: false,
		},
		{
			name:        "empty ID returns validation error",
			id:          "",
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: RotationErrorCodeValidation,
		},
		{
			name: "service error returns service error",
			id:   "policy-123",
			mockFn: func(_ context.Context, _ string) (*sdk.RotationPolicyResponse, error) {
				return nil, errService
			},
			wantErr:     true,
			wantErrCode: RotationErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &getPolicyUseCase{
				rotationService: &mockRotationService{
					getPolicyFn: tt.mockFn,
				},
			}

			resp, err := uc.Execute(context.Background(), tt.id)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var rotErr *RotationError
				if !errors.As(err, &rotErr) {
					t.Fatalf("expected *RotationError, got %T", err)
				}
				if rotErr.Code != tt.wantErrCode {
					t.Errorf("expected error code '%s', got '%s'", tt.wantErrCode, rotErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if resp == nil {
				t.Fatal("expected non-nil response")
			}
			if resp.Id != "policy-123" {
				t.Errorf("expected policy ID 'policy-123', got '%s'", resp.Id)
			}
		})
	}
}

// --- UpdatePolicyUseCase ---

func TestUpdatePolicyUseCase_Execute(t *testing.T) {
	newCron := "0 */12 * * *"
	updateReq := &sdk.UpdateRotationPolicyRequest{
		ScheduleCron: &newCron,
	}

	expectedPolicy := &sdk.RotationPolicyResponse{
		Id:           "policy-123",
		ScheduleCron: "0 */12 * * *",
	}

	tests := []struct {
		name        string
		id          string
		req         *sdk.UpdateRotationPolicyRequest
		mockFn      func(ctx context.Context, id string, req *sdk.UpdateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error)
		wantErr     bool
		wantErrCode string
	}{
		{
			name: "success",
			id:   "policy-123",
			req:  updateReq,
			mockFn: func(_ context.Context, id string, _ *sdk.UpdateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error) {
				if id != "policy-123" {
					t.Errorf("expected ID 'policy-123', got '%s'", id)
				}
				return expectedPolicy, nil
			},
			wantErr: false,
		},
		{
			name:        "empty ID returns validation error",
			id:          "",
			req:         updateReq,
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: RotationErrorCodeValidation,
		},
		{
			name: "service error returns service error",
			id:   "policy-123",
			req:  updateReq,
			mockFn: func(_ context.Context, _ string, _ *sdk.UpdateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error) {
				return nil, errService
			},
			wantErr:     true,
			wantErrCode: RotationErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &updatePolicyUseCase{
				rotationService: &mockRotationService{
					updatePolicyFn: tt.mockFn,
				},
			}

			resp, err := uc.Execute(context.Background(), tt.id, tt.req)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var rotErr *RotationError
				if !errors.As(err, &rotErr) {
					t.Fatalf("expected *RotationError, got %T", err)
				}
				if rotErr.Code != tt.wantErrCode {
					t.Errorf("expected error code '%s', got '%s'", tt.wantErrCode, rotErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if resp == nil {
				t.Fatal("expected non-nil response")
			}
		})
	}
}

// --- DeletePolicyUseCase ---

func TestDeletePolicyUseCase_Execute(t *testing.T) {
	tests := []struct {
		name        string
		id          string
		mockFn      func(ctx context.Context, id string) (*sdk.ErrorResponse, error)
		wantErr     bool
		wantErrCode string
	}{
		{
			name: "success",
			id:   "policy-123",
			mockFn: func(_ context.Context, id string) (*sdk.ErrorResponse, error) {
				if id != "policy-123" {
					t.Errorf("expected ID 'policy-123', got '%s'", id)
				}
				return nil, nil
			},
			wantErr: false,
		},
		{
			name:        "empty ID returns validation error",
			id:          "",
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: RotationErrorCodeValidation,
		},
		{
			name: "service error returns service error",
			id:   "policy-123",
			mockFn: func(_ context.Context, _ string) (*sdk.ErrorResponse, error) {
				return nil, errService
			},
			wantErr:     true,
			wantErrCode: RotationErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &deletePolicyUseCase{
				rotationService: &mockRotationService{
					deletePolicyFn: tt.mockFn,
				},
			}

			err := uc.Execute(context.Background(), tt.id)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var rotErr *RotationError
				if !errors.As(err, &rotErr) {
					t.Fatalf("expected *RotationError, got %T", err)
				}
				if rotErr.Code != tt.wantErrCode {
					t.Errorf("expected error code '%s', got '%s'", tt.wantErrCode, rotErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

// --- TriggerRotationUseCase ---

func TestTriggerRotationUseCase_Execute(t *testing.T) {
	expectedResp := &sdk.TriggerRotationResponse{
		Message:             "rotation triggered",
		RotationStateId:     "state-123",
		NewCredentialStored: true,
	}

	tests := []struct {
		name        string
		id          string
		mockFn      func(ctx context.Context, id string) (*sdk.TriggerRotationResponse, error)
		wantErr     bool
		wantErrCode string
	}{
		{
			name: "success",
			id:   "policy-123",
			mockFn: func(_ context.Context, id string) (*sdk.TriggerRotationResponse, error) {
				if id != "policy-123" {
					t.Errorf("expected ID 'policy-123', got '%s'", id)
				}
				return expectedResp, nil
			},
			wantErr: false,
		},
		{
			name:        "empty ID returns validation error",
			id:          "",
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: RotationErrorCodeValidation,
		},
		{
			name: "service error returns service error",
			id:   "policy-123",
			mockFn: func(_ context.Context, _ string) (*sdk.TriggerRotationResponse, error) {
				return nil, errService
			},
			wantErr:     true,
			wantErrCode: RotationErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &triggerRotationUseCase{
				rotationService: &mockRotationService{
					triggerRotationFn: tt.mockFn,
				},
			}

			resp, err := uc.Execute(context.Background(), tt.id)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var rotErr *RotationError
				if !errors.As(err, &rotErr) {
					t.Fatalf("expected *RotationError, got %T", err)
				}
				if rotErr.Code != tt.wantErrCode {
					t.Errorf("expected error code '%s', got '%s'", tt.wantErrCode, rotErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if resp == nil {
				t.Fatal("expected non-nil response")
			}
			if resp.Message != "rotation triggered" {
				t.Errorf("expected message 'rotation triggered', got '%s'", resp.Message)
			}
		})
	}
}

// --- GetRotationStatesUseCase ---

func TestGetRotationStatesUseCase_Execute(t *testing.T) {
	expectedStates := sdk.RotationStatesResponse{
		&sdk.RotationStateResponse{Id: "s1", RotationPolicyId: "policy-123"},
		&sdk.RotationStateResponse{Id: "s2", RotationPolicyId: "policy-123"},
	}

	tests := []struct {
		name        string
		id          string
		mockFn      func(ctx context.Context, id string) (sdk.RotationStatesResponse, error)
		wantErr     bool
		wantErrCode string
		wantCount   int
	}{
		{
			name: "success with results",
			id:   "policy-123",
			mockFn: func(_ context.Context, id string) (sdk.RotationStatesResponse, error) {
				if id != "policy-123" {
					t.Errorf("expected ID 'policy-123', got '%s'", id)
				}
				return expectedStates, nil
			},
			wantErr:   false,
			wantCount: 2,
		},
		{
			name: "success with empty states",
			id:   "policy-123",
			mockFn: func(_ context.Context, _ string) (sdk.RotationStatesResponse, error) {
				return sdk.RotationStatesResponse{}, nil
			},
			wantErr:   false,
			wantCount: 0,
		},
		{
			name:        "empty ID returns validation error",
			id:          "",
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: RotationErrorCodeValidation,
		},
		{
			name: "service error returns service error",
			id:   "policy-123",
			mockFn: func(_ context.Context, _ string) (sdk.RotationStatesResponse, error) {
				return nil, errService
			},
			wantErr:     true,
			wantErrCode: RotationErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &getRotationStatesUseCase{
				rotationService: &mockRotationService{
					getRotationStatesFn: tt.mockFn,
				},
			}

			resp, err := uc.Execute(context.Background(), tt.id)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var rotErr *RotationError
				if !errors.As(err, &rotErr) {
					t.Fatalf("expected *RotationError, got %T", err)
				}
				if rotErr.Code != tt.wantErrCode {
					t.Errorf("expected error code '%s', got '%s'", tt.wantErrCode, rotErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(resp) != tt.wantCount {
				t.Errorf("expected %d states, got %d", tt.wantCount, len(resp))
			}
		})
	}
}

// --- RevokeExpiredCredentialsUseCase ---

func TestRevokeExpiredCredentialsUseCase_Execute(t *testing.T) {
	expectedResp := &sdk.RevokeOldCredentialResponse{
		Message:   "expired credentials revoked",
		RevokedAt: "2025-01-15T10:00:00Z",
	}

	tests := []struct {
		name    string
		mockFn  func(ctx context.Context) (*sdk.RevokeOldCredentialResponse, error)
		wantErr bool
	}{
		{
			name: "success",
			mockFn: func(_ context.Context) (*sdk.RevokeOldCredentialResponse, error) {
				return expectedResp, nil
			},
			wantErr: false,
		},
		{
			name: "service error",
			mockFn: func(_ context.Context) (*sdk.RevokeOldCredentialResponse, error) {
				return nil, errService
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &revokeExpiredCredentialsUseCase{
				rotationService: &mockRotationService{
					revokeExpiredCredsFn: tt.mockFn,
				},
			}

			resp, err := uc.Execute(context.Background())

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var rotErr *RotationError
				if !errors.As(err, &rotErr) {
					t.Fatalf("expected *RotationError, got %T", err)
				}
				if rotErr.Code != RotationErrorCodeServiceError {
					t.Errorf("expected error code '%s', got '%s'", RotationErrorCodeServiceError, rotErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if resp == nil {
				t.Fatal("expected non-nil response")
			}
			if resp.Message != "expired credentials revoked" {
				t.Errorf("expected message 'expired credentials revoked', got '%s'", resp.Message)
			}
		})
	}
}

// --- Error type tests ---

func TestRotationError_Error(t *testing.T) {
	tests := []struct {
		name     string
		err      *RotationError
		expected string
	}{
		{
			name: "with cause",
			err: &RotationError{
				Code:    RotationErrorCodeServiceError,
				Message: "operation failed",
				Cause:   errors.New("underlying error"),
			},
			expected: "operation failed: underlying error",
		},
		{
			name: "without cause",
			err: &RotationError{
				Code:    RotationErrorCodeValidation,
				Message: "validation failed",
			},
			expected: "validation failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.err.Error() != tt.expected {
				t.Errorf("expected '%s', got '%s'", tt.expected, tt.err.Error())
			}
		})
	}
}

func TestRotationError_Unwrap(t *testing.T) {
	cause := errors.New("root cause")
	rotErr := &RotationError{
		Code:    RotationErrorCodeServiceError,
		Message: "wrapped",
		Cause:   cause,
	}

	if !errors.Is(rotErr, cause) {
		t.Error("expected Unwrap to return the cause error")
	}
}

func TestNewValidationError(t *testing.T) {
	cause := errors.New("bad input")
	err := NewValidationError("validation failed", cause)

	if err.Code != RotationErrorCodeValidation {
		t.Errorf("expected code '%s', got '%s'", RotationErrorCodeValidation, err.Code)
	}
	if err.Message != "validation failed" {
		t.Errorf("expected message 'validation failed', got '%s'", err.Message)
	}
	if !errors.Is(err, cause) {
		t.Error("expected error to wrap the cause")
	}
}

func TestNewNotFoundError(t *testing.T) {
	cause := errors.New("not found")
	err := NewNotFoundError("resource missing", cause)

	if err.Code != RotationErrorCodeNotFound {
		t.Errorf("expected code '%s', got '%s'", RotationErrorCodeNotFound, err.Code)
	}
	if !errors.Is(err, cause) {
		t.Error("expected error to wrap the cause")
	}
}

func TestNewServiceError(t *testing.T) {
	cause := errors.New("internal")
	err := NewServiceError("service down", cause)

	if err.Code != RotationErrorCodeServiceError {
		t.Errorf("expected code '%s', got '%s'", RotationErrorCodeServiceError, err.Code)
	}
	if !errors.Is(err, cause) {
		t.Error("expected error to wrap the cause")
	}
}

// --- Sentinel error tests ---

func TestSentinelErrors(t *testing.T) {
	sentinels := []struct {
		name string
		err  error
	}{
		{"ErrIDRequired", ErrIDRequired},
		{"ErrNameRequired", ErrNameRequired},
		{"ErrEngineRequired", ErrEngineRequired},
		{"ErrSecretIDRequired", ErrSecretIDRequired},
		{"ErrScheduleRequired", ErrScheduleRequired},
		{"ErrInvalidEngineType", ErrInvalidEngineType},
		{"ErrPolicyNotFound", ErrPolicyNotFound},
		{"ErrFailedToList", ErrFailedToList},
		{"ErrFailedToCreate", ErrFailedToCreate},
		{"ErrFailedToGet", ErrFailedToGet},
		{"ErrFailedToUpdate", ErrFailedToUpdate},
		{"ErrFailedToDelete", ErrFailedToDelete},
		{"ErrFailedToTrigger", ErrFailedToTrigger},
		{"ErrFailedToGetStates", ErrFailedToGetStates},
		{"ErrFailedToRevoke", ErrFailedToRevoke},
	}

	for _, tt := range sentinels {
		t.Run(tt.name, func(t *testing.T) {
			if tt.err == nil {
				t.Errorf("sentinel error %s is nil", tt.name)
			}
			if tt.err.Error() == "" {
				t.Errorf("sentinel error %s has empty message", tt.name)
			}
		})
	}
}
