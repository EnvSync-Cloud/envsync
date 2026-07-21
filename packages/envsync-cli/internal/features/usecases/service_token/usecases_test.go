package service_token

import (
	"context"
	"errors"
	"strings"
	"testing"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
)

// mockServiceTokenService is a test double implementing services.ServiceTokenService.
// Each method delegates to an assignable function field so tests control behavior.
type mockServiceTokenService struct {
	createFn      func(ctx context.Context, req *sdk.CreateServiceTokenRequest) (*sdk.CreateServiceTokenResponse, error)
	getAllFn      func(ctx context.Context) (sdk.ServiceTokensResponse, error)
	getByIDFn     func(ctx context.Context, id string) (*sdk.ServiceTokenResponse, error)
	deleteFn      func(ctx context.Context, id string) error
}

var _ services.ServiceTokenService = (*mockServiceTokenService)(nil)

func (m *mockServiceTokenService) CreateServiceToken(ctx context.Context, req *sdk.CreateServiceTokenRequest) (*sdk.CreateServiceTokenResponse, error) {
	if m.createFn != nil {
		return m.createFn(ctx, req)
	}
	return nil, nil
}

func (m *mockServiceTokenService) GetAllServiceTokens(ctx context.Context) (sdk.ServiceTokensResponse, error) {
	if m.getAllFn != nil {
		return m.getAllFn(ctx)
	}
	return nil, nil
}

func (m *mockServiceTokenService) GetServiceToken(ctx context.Context, id string) (*sdk.ServiceTokenResponse, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, id)
	}
	return nil, nil
}

func (m *mockServiceTokenService) DeleteServiceToken(ctx context.Context, id string) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, id)
	}
	return nil
}

// --- Errors tests ---

func TestServiceTokenError_Error(t *testing.T) {
	tests := []struct {
		name     string
		err      ServiceTokenError
		contains string
	}{
		{
			name: "message only",
			err: ServiceTokenError{
				Code:    ServiceTokenErrorCodeValidation,
				Message: "bad input",
			},
			contains: "bad input",
		},
		{
			name: "message with cause",
			err: ServiceTokenError{
				Code:    ServiceTokenErrorCodeServiceError,
				Message: "operation failed",
				Cause:   errors.New("connection refused"),
			},
			contains: "operation failed: connection refused",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.err.Error()
			if got != tt.contains {
				t.Errorf("Error() = %q, want %q", got, tt.contains)
			}
		})
	}
}

func TestServiceTokenError_Unwrap(t *testing.T) {
	cause := errors.New("root cause")
	err := ServiceTokenError{
		Code:    ServiceTokenErrorCodeServiceError,
		Message: "wrapped",
		Cause:   cause,
	}

	if err.Unwrap() != cause {
		t.Errorf("Unwrap() = %v, want %v", err.Unwrap(), cause)
	}

	nilCause := ServiceTokenError{Code: "X", Message: "no cause"}
	if nilCause.Unwrap() != nil {
		t.Error("Unwrap() should return nil when Cause is nil")
	}
}

func TestNewServiceTokenValidationError(t *testing.T) {
	cause := ErrTokenNameRequired
	err := NewServiceTokenValidationError("name empty", cause)

	if err.Code != ServiceTokenErrorCodeValidation {
		t.Errorf("Code = %q, want %q", err.Code, ServiceTokenErrorCodeValidation)
	}
	if err.Message != "name empty" {
		t.Errorf("Message = %q, want %q", err.Message, "name empty")
	}
	if err.Cause != cause {
		t.Errorf("Cause = %v, want %v", err.Cause, cause)
	}
}

func TestNewServiceTokenNotFoundError(t *testing.T) {
	err := NewServiceTokenNotFoundError("not there", ErrTokenNotFound)

	if err.Code != ServiceTokenErrorCodeNotFound {
		t.Errorf("Code = %q, want %q", err.Code, ServiceTokenErrorCodeNotFound)
	}
	if err.Cause != ErrTokenNotFound {
		t.Errorf("Cause = %v, want %v", err.Cause, ErrTokenNotFound)
	}
}

func TestNewServiceTokenServiceError(t *testing.T) {
	inner := errors.New("timeout")
	err := NewServiceTokenServiceError("call failed", inner)

	if err.Code != ServiceTokenErrorCodeServiceError {
		t.Errorf("Code = %q, want %q", err.Code, ServiceTokenErrorCodeServiceError)
	}
	if err.Cause != inner {
		t.Errorf("Cause = %v, want %v", err.Cause, inner)
	}
}

func TestSentinelErrors(t *testing.T) {
	if ErrTokenNameRequired == nil {
		t.Error("ErrTokenNameRequired should not be nil")
	}
	if ErrTokenIDRequired == nil {
		t.Error("ErrTokenIDRequired should not be nil")
	}
	if ErrTokenNotFound == nil {
		t.Error("ErrTokenNotFound should not be nil")
	}

	if ErrTokenNameRequired.Error() != "service token name is required" {
		t.Errorf("ErrTokenNameRequired.Error() = %q", ErrTokenNameRequired.Error())
	}
	if ErrTokenIDRequired.Error() != "service token ID is required" {
		t.Errorf("ErrTokenIDRequired.Error() = %q", ErrTokenIDRequired.Error())
	}
	if ErrTokenNotFound.Error() != "service token not found" {
		t.Errorf("ErrTokenNotFound.Error() = %q", ErrTokenNotFound.Error())
	}
}

// --- CreateServiceTokenUseCase tests ---

func TestCreateServiceTokenUseCase_Execute(t *testing.T) {
	tests := []struct {
		name        string
		req         *sdk.CreateServiceTokenRequest
		mockFn      func(ctx context.Context, req *sdk.CreateServiceTokenRequest) (*sdk.CreateServiceTokenResponse, error)
		wantErr     bool
		wantCode    string
		errContains string
	}{
		{
			name: "success",
			req:  &sdk.CreateServiceTokenRequest{Name: "my-token"},
			mockFn: func(_ context.Context, req *sdk.CreateServiceTokenRequest) (*sdk.CreateServiceTokenResponse, error) {
				return &sdk.CreateServiceTokenResponse{
					Id:    "tok-123",
					Token: "secret-value",
					Name:  req.Name,
				}, nil
			},
			wantErr: false,
		},
		{
			name:        "empty name",
			req:         &sdk.CreateServiceTokenRequest{Name: ""},
			wantErr:     true,
			wantCode:    ServiceTokenErrorCodeValidation,
			errContains: "name cannot be empty",
		},
		{
			name:        "whitespace only name",
			req:         &sdk.CreateServiceTokenRequest{Name: "   "},
			wantErr:     true,
			wantCode:    ServiceTokenErrorCodeValidation,
			errContains: "name cannot be empty",
		},
		{
			name:        "tab-only name",
			req:         &sdk.CreateServiceTokenRequest{Name: "\t\n"},
			wantErr:     true,
			wantCode:    ServiceTokenErrorCodeValidation,
			errContains: "name cannot be empty",
		},
		{
			name: "service returns error",
			req:  &sdk.CreateServiceTokenRequest{Name: "valid-name"},
			mockFn: func(_ context.Context, _ *sdk.CreateServiceTokenRequest) (*sdk.CreateServiceTokenResponse, error) {
				return nil, errors.New("network error")
			},
			wantErr:     true,
			wantCode:    ServiceTokenErrorCodeServiceError,
			errContains: "failed to create service token",
		},
		{
			name: "name with leading/trailing spaces is valid",
			req:  &sdk.CreateServiceTokenRequest{Name: "  real-token  "},
			mockFn: func(_ context.Context, req *sdk.CreateServiceTokenRequest) (*sdk.CreateServiceTokenResponse, error) {
				return &sdk.CreateServiceTokenResponse{
					Id:   "tok-456",
					Name: strings.TrimSpace(req.Name),
				}, nil
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &createServiceTokenUseCase{
				service: &mockServiceTokenService{createFn: tt.mockFn},
			}

			resp, err := uc.Execute(context.Background(), tt.req)

			if tt.wantErr {
				if err == nil {
					t.Fatal("Execute() error = nil, want error")
				}
				if !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("error %q does not contain %q", err.Error(), tt.errContains)
				}
				var svcErr *ServiceTokenError
				if !errors.As(err, &svcErr) {
					t.Errorf("error is not *ServiceTokenError: %T", err)
				} else if svcErr.Code != tt.wantCode {
					t.Errorf("Code = %q, want %q", svcErr.Code, tt.wantCode)
				}
				if resp != nil {
					t.Errorf("response = %v, want nil on error", resp)
				}
				return
			}

			if err != nil {
				t.Fatalf("Execute() error = %v, want nil", err)
			}
			if resp == nil {
				t.Fatal("Execute() response = nil, want non-nil")
			}
		})
	}
}

// --- ListServiceTokensUseCase tests ---

func TestListServiceTokensUseCase_Execute(t *testing.T) {
	tests := []struct {
		name     string
		mockFn   func(ctx context.Context) (sdk.ServiceTokensResponse, error)
		wantErr  bool
		wantCode string
		wantLen  int
	}{
		{
			name: "success with tokens",
			mockFn: func(_ context.Context) (sdk.ServiceTokensResponse, error) {
				return sdk.ServiceTokensResponse{
					&sdk.ServiceTokenResponse{Id: "tok-1", Name: "alpha"},
					&sdk.ServiceTokenResponse{Id: "tok-2", Name: "beta"},
				}, nil
			},
			wantErr: false,
			wantLen: 2,
		},
		{
			name: "success empty list",
			mockFn: func(_ context.Context) (sdk.ServiceTokensResponse, error) {
				return sdk.ServiceTokensResponse{}, nil
			},
			wantErr: false,
			wantLen: 0,
		},
		{
			name: "success nil list",
			mockFn: func(_ context.Context) (sdk.ServiceTokensResponse, error) {
				return nil, nil
			},
			wantErr: false,
			wantLen: 0,
		},
		{
			name: "service error",
			mockFn: func(_ context.Context) (sdk.ServiceTokensResponse, error) {
				return nil, errors.New("unauthorized")
			},
			wantErr:  true,
			wantCode: ServiceTokenErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &listServiceTokensUseCase{
				service: &mockServiceTokenService{getAllFn: tt.mockFn},
			}

			resp, err := uc.Execute(context.Background())

			if tt.wantErr {
				if err == nil {
					t.Fatal("Execute() error = nil, want error")
				}
				if !strings.Contains(err.Error(), "failed to list service tokens") {
					t.Errorf("error %q does not contain expected prefix", err.Error())
				}
				var svcErr *ServiceTokenError
				if !errors.As(err, &svcErr) {
					t.Errorf("error is not *ServiceTokenError: %T", err)
				} else if svcErr.Code != tt.wantCode {
					t.Errorf("Code = %q, want %q", svcErr.Code, tt.wantCode)
				}
				return
			}

			if err != nil {
				t.Fatalf("Execute() error = %v, want nil", err)
			}
			if len(resp) != tt.wantLen {
				t.Errorf("len(response) = %d, want %d", len(resp), tt.wantLen)
			}
		})
	}
}

// --- GetServiceTokenUseCase tests ---

func TestGetServiceTokenUseCase_Execute(t *testing.T) {
	tests := []struct {
		name        string
		id          string
		mockFn      func(ctx context.Context, id string) (*sdk.ServiceTokenResponse, error)
		wantErr     bool
		wantCode    string
		errContains string
	}{
		{
			name: "success",
			id:   "tok-abc",
			mockFn: func(_ context.Context, id string) (*sdk.ServiceTokenResponse, error) {
				return &sdk.ServiceTokenResponse{
					Id:   id,
					Name: "my-token",
				}, nil
			},
			wantErr: false,
		},
		{
			name:        "empty id",
			id:          "",
			wantErr:     true,
			wantCode:    ServiceTokenErrorCodeValidation,
			errContains: "ID is required",
		},
		{
			name:        "whitespace only id",
			id:          "   ",
			wantErr:     true,
			wantCode:    ServiceTokenErrorCodeValidation,
			errContains: "ID is required",
		},
		{
			name:        "tab-only id",
			id:          "\t",
			wantErr:     true,
			wantCode:    ServiceTokenErrorCodeValidation,
			errContains: "ID is required",
		},
		{
			name: "service error",
			id:   "tok-valid",
			mockFn: func(_ context.Context, _ string) (*sdk.ServiceTokenResponse, error) {
				return nil, errors.New("connection reset")
			},
			wantErr:     true,
			wantCode:    ServiceTokenErrorCodeServiceError,
			errContains: "failed to get service token",
		},
		{
			name: "not found wraps as service error",
			id:   "tok-missing",
			mockFn: func(_ context.Context, _ string) (*sdk.ServiceTokenResponse, error) {
				return nil, NewServiceTokenNotFoundError("token not found", ErrTokenNotFound)
			},
			wantErr:     true,
			wantCode:    ServiceTokenErrorCodeServiceError,
			errContains: "failed to get service token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &getServiceTokenUseCase{
				service: &mockServiceTokenService{getByIDFn: tt.mockFn},
			}

			resp, err := uc.Execute(context.Background(), tt.id)

			if tt.wantErr {
				if err == nil {
					t.Fatal("Execute() error = nil, want error")
				}
				if !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("error %q does not contain %q", err.Error(), tt.errContains)
				}
				var svcErr *ServiceTokenError
				if !errors.As(err, &svcErr) {
					t.Errorf("error is not *ServiceTokenError: %T", err)
				} else if svcErr.Code != tt.wantCode {
					t.Errorf("Code = %q, want %q", svcErr.Code, tt.wantCode)
				}
				if resp != nil {
					t.Errorf("response = %v, want nil on error", resp)
				}
				return
			}

			if err != nil {
				t.Fatalf("Execute() error = %v, want nil", err)
			}
			if resp == nil {
				t.Fatal("Execute() response = nil, want non-nil")
			}
		})
	}
}

// --- DeleteServiceTokenUseCase tests ---

func TestDeleteServiceTokenUseCase_Execute(t *testing.T) {
	tests := []struct {
		name        string
		id          string
		mockFn      func(ctx context.Context, id string) error
		wantErr     bool
		wantCode    string
		errContains string
	}{
		{
			name: "success",
			id:   "tok-del",
			mockFn: func(_ context.Context, _ string) error {
				return nil
			},
			wantErr: false,
		},
		{
			name:        "empty id",
			id:          "",
			wantErr:     true,
			wantCode:    ServiceTokenErrorCodeValidation,
			errContains: "ID is required",
		},
		{
			name:        "whitespace only id",
			id:          "   ",
			wantErr:     true,
			wantCode:    ServiceTokenErrorCodeValidation,
			errContains: "ID is required",
		},
		{
			name:        "newline-only id",
			id:          "\n",
			wantErr:     true,
			wantCode:    ServiceTokenErrorCodeValidation,
			errContains: "ID is required",
		},
		{
			name: "service error",
			id:   "tok-valid",
			mockFn: func(_ context.Context, _ string) error {
				return errors.New("permission denied")
			},
			wantErr:     true,
			wantCode:    ServiceTokenErrorCodeServiceError,
			errContains: "failed to delete service token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &deleteServiceTokenUseCase{
				service: &mockServiceTokenService{deleteFn: tt.mockFn},
			}

			err := uc.Execute(context.Background(), tt.id)

			if tt.wantErr {
				if err == nil {
					t.Fatal("Execute() error = nil, want error")
				}
				if !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("error %q does not contain %q", err.Error(), tt.errContains)
				}
				var svcErr *ServiceTokenError
				if !errors.As(err, &svcErr) {
					t.Errorf("error is not *ServiceTokenError: %T", err)
				} else if svcErr.Code != tt.wantCode {
					t.Errorf("Code = %q, want %q", svcErr.Code, tt.wantCode)
				}
				return
			}

			if err != nil {
				t.Fatalf("Execute() error = %v, want nil", err)
			}
		})
	}
}
