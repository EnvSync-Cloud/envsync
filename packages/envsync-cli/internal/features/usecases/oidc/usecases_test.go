package oidc

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
)

// Ensure mockOidcService satisfies the interface at compile time.
var _ services.OidcService = (*mockOidcService)(nil)

type mockOidcService struct {
	createProviderFn func(ctx context.Context, input domain.CreateOidcProviderInput) (*domain.OidcProvider, error)
	listProvidersFn  func(ctx context.Context) ([]domain.OidcProvider, error)
	getProviderFn    func(ctx context.Context, id string) (*domain.OidcProvider, error)
	updateProviderFn func(ctx context.Context, input domain.UpdateOidcProviderInput) error
	deleteProviderFn func(ctx context.Context, id string) error
}

func (m *mockOidcService) CreateProvider(ctx context.Context, input domain.CreateOidcProviderInput) (*domain.OidcProvider, error) {
	return m.createProviderFn(ctx, input)
}

func (m *mockOidcService) ListProviders(ctx context.Context) ([]domain.OidcProvider, error) {
	return m.listProvidersFn(ctx)
}

func (m *mockOidcService) GetProvider(ctx context.Context, id string) (*domain.OidcProvider, error) {
	return m.getProviderFn(ctx, id)
}

func (m *mockOidcService) UpdateProvider(ctx context.Context, input domain.UpdateOidcProviderInput) error {
	return m.updateProviderFn(ctx, input)
}

func (m *mockOidcService) DeleteProvider(ctx context.Context, id string) error {
	return m.deleteProviderFn(ctx, id)
}

// --- CreateOidcProviderUseCase ---

func TestCreateOidcProviderUseCase_Execute(t *testing.T) {
	tests := []struct {
		name          string
		input         domain.CreateOidcProviderInput
		mockFn        func(ctx context.Context, input domain.CreateOidcProviderInput) (*domain.OidcProvider, error)
		wantErr       bool
		wantErrIs     error
		wantErrCode   string
		wantNilResult bool
	}{
		{
			name: "success with github_actions",
			input: domain.CreateOidcProviderInput{
				ProviderType: "github_actions",
				IssuerURL:    "https://token.actions.githubusercontent.com",
				Audience:     "https://envsync.cloud",
			},
			mockFn: func(_ context.Context, input domain.CreateOidcProviderInput) (*domain.OidcProvider, error) {
				return &domain.OidcProvider{
					ID:           "oidc-123",
					ProviderType: input.ProviderType,
					IssuerURL:    input.IssuerURL,
					Audience:     input.Audience,
					Enabled:      true,
				}, nil
			},
			wantErr: false,
		},
		{
			name: "success with kubernetes",
			input: domain.CreateOidcProviderInput{
				ProviderType:    "kubernetes",
				IssuerURL:       "https://kubernetes.default.svc",
				Audience:        "envsync",
				AllowedSubjects: []string{"system:serviceaccount:default:myapp"},
			},
			mockFn: func(_ context.Context, input domain.CreateOidcProviderInput) (*domain.OidcProvider, error) {
				return &domain.OidcProvider{
					ID:              "oidc-456",
					ProviderType:    input.ProviderType,
					IssuerURL:       input.IssuerURL,
					Audience:        input.Audience,
					AllowedSubjects: input.AllowedSubjects,
					Enabled:         true,
				}, nil
			},
			wantErr: false,
		},
		{
			name: "success with generic",
			input: domain.CreateOidcProviderInput{
				ProviderType: "generic",
				IssuerURL:    "https://accounts.google.com",
				Audience:     "envsync-client",
			},
			mockFn: func(_ context.Context, _ domain.CreateOidcProviderInput) (*domain.OidcProvider, error) {
				return &domain.OidcProvider{ID: "oidc-789", ProviderType: "generic"}, nil
			},
			wantErr: false,
		},
		{
			name: "success with gitlab_ci",
			input: domain.CreateOidcProviderInput{
				ProviderType: "gitlab_ci",
				IssuerURL:    "https://gitlab.com",
				Audience:     "https://envsync.cloud",
			},
			mockFn: func(_ context.Context, _ domain.CreateOidcProviderInput) (*domain.OidcProvider, error) {
				return &domain.OidcProvider{ID: "oidc-gitlab", ProviderType: "gitlab_ci"}, nil
			},
			wantErr: false,
		},
		{
			name: "validation error - empty provider type",
			input: domain.CreateOidcProviderInput{
				ProviderType: "",
				IssuerURL:    "https://token.actions.githubusercontent.com",
				Audience:     "https://envsync.cloud",
			},
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrProviderTypeRequired,
			wantErrCode:   OidcErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name: "validation error - whitespace provider type",
			input: domain.CreateOidcProviderInput{
				ProviderType: "   ",
				IssuerURL:    "https://token.actions.githubusercontent.com",
				Audience:     "https://envsync.cloud",
			},
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrProviderTypeRequired,
			wantErrCode:   OidcErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name: "validation error - empty issuer URL",
			input: domain.CreateOidcProviderInput{
				ProviderType: "github_actions",
				IssuerURL:    "",
				Audience:     "https://envsync.cloud",
			},
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrIssuerURLRequired,
			wantErrCode:   OidcErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name: "validation error - whitespace issuer URL",
			input: domain.CreateOidcProviderInput{
				ProviderType: "github_actions",
				IssuerURL:    "  \t  ",
				Audience:     "https://envsync.cloud",
			},
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrIssuerURLRequired,
			wantErrCode:   OidcErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name: "validation error - empty audience",
			input: domain.CreateOidcProviderInput{
				ProviderType: "github_actions",
				IssuerURL:    "https://token.actions.githubusercontent.com",
				Audience:     "",
			},
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrAudienceRequired,
			wantErrCode:   OidcErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name: "validation error - invalid provider type",
			input: domain.CreateOidcProviderInput{
				ProviderType: "aws_sts",
				IssuerURL:    "https://sts.amazonaws.com",
				Audience:     "envsync",
			},
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrInvalidProviderType,
			wantErrCode:   OidcErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name: "service error",
			input: domain.CreateOidcProviderInput{
				ProviderType: "github_actions",
				IssuerURL:    "https://token.actions.githubusercontent.com",
				Audience:     "https://envsync.cloud",
			},
			mockFn: func(_ context.Context, _ domain.CreateOidcProviderInput) (*domain.OidcProvider, error) {
				return nil, errors.New("network error")
			},
			wantErr:       true,
			wantErrCode:   OidcErrorCodeServiceError,
			wantNilResult: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &createOidcProviderUseCase{
				service: &mockOidcService{createProviderFn: tt.mockFn},
			}

			result, err := uc.Execute(context.Background(), tt.input)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var oidcErr *OidcError
				if !errors.As(err, &oidcErr) {
					t.Fatalf("expected *OidcError, got %T", err)
				}
				if oidcErr.Code != tt.wantErrCode {
					t.Errorf("expected error code %q, got %q", tt.wantErrCode, oidcErr.Code)
				}
				if tt.wantErrIs != nil && !errors.Is(err, tt.wantErrIs) {
					t.Errorf("expected error to wrap %v, got %v", tt.wantErrIs, err)
				}
				if tt.wantNilResult && result != nil {
					t.Errorf("expected nil result, got %+v", result)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result == nil {
				t.Fatal("expected non-nil result")
			}
		})
	}
}

// --- ListOidcProvidersUseCase ---

func TestListOidcProvidersUseCase_Execute(t *testing.T) {
	tests := []struct {
		name         string
		mockFn       func(ctx context.Context) ([]domain.OidcProvider, error)
		wantErr      bool
		wantErrCode  string
		wantCount    int
	}{
		{
			name: "success - empty list",
			mockFn: func(_ context.Context) ([]domain.OidcProvider, error) {
				return []domain.OidcProvider{}, nil
			},
			wantErr:   false,
			wantCount: 0,
		},
		{
			name: "success - multiple providers",
			mockFn: func(_ context.Context) ([]domain.OidcProvider, error) {
				return []domain.OidcProvider{
					{ID: "oidc-1", ProviderType: "github_actions"},
					{ID: "oidc-2", ProviderType: "gitlab_ci"},
					{ID: "oidc-3", ProviderType: "kubernetes"},
				}, nil
			},
			wantErr:   false,
			wantCount: 3,
		},
		{
			name: "service error",
			mockFn: func(_ context.Context) ([]domain.OidcProvider, error) {
				return nil, errors.New("connection refused")
			},
			wantErr:     true,
			wantErrCode: OidcErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &listOidcProvidersUseCase{
				service: &mockOidcService{listProvidersFn: tt.mockFn},
			}

			result, err := uc.Execute(context.Background())

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var oidcErr *OidcError
				if !errors.As(err, &oidcErr) {
					t.Fatalf("expected *OidcError, got %T", err)
				}
				if oidcErr.Code != tt.wantErrCode {
					t.Errorf("expected error code %q, got %q", tt.wantErrCode, oidcErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(result) != tt.wantCount {
				t.Errorf("expected %d providers, got %d", tt.wantCount, len(result))
			}
		})
	}
}

// --- GetOidcProviderUseCase ---

func TestGetOidcProviderUseCase_Execute(t *testing.T) {
	tests := []struct {
		name          string
		id            string
		mockFn        func(ctx context.Context, id string) (*domain.OidcProvider, error)
		wantErr       bool
		wantErrIs     error
		wantErrCode   string
		wantNilResult bool
	}{
		{
			name: "success",
			id:   "oidc-123",
			mockFn: func(_ context.Context, id string) (*domain.OidcProvider, error) {
				return &domain.OidcProvider{
					ID:           id,
					ProviderType: "github_actions",
					IssuerURL:    "https://token.actions.githubusercontent.com",
					Audience:     "envsync",
					Enabled:      true,
				}, nil
			},
			wantErr: false,
		},
		{
			name:          "validation error - empty ID",
			id:            "",
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrProviderIDRequired,
			wantErrCode:   OidcErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name:          "validation error - whitespace ID",
			id:            "   \t  ",
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrProviderIDRequired,
			wantErrCode:   OidcErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name: "service error",
			id:   "oidc-nonexistent",
			mockFn: func(_ context.Context, _ string) (*domain.OidcProvider, error) {
				return nil, errors.New("not found")
			},
			wantErr:       true,
			wantErrCode:   OidcErrorCodeServiceError,
			wantNilResult: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &getOidcProviderUseCase{
				service: &mockOidcService{getProviderFn: tt.mockFn},
			}

			result, err := uc.Execute(context.Background(), tt.id)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var oidcErr *OidcError
				if !errors.As(err, &oidcErr) {
					t.Fatalf("expected *OidcError, got %T", err)
				}
				if oidcErr.Code != tt.wantErrCode {
					t.Errorf("expected error code %q, got %q", tt.wantErrCode, oidcErr.Code)
				}
				if tt.wantErrIs != nil && !errors.Is(err, tt.wantErrIs) {
					t.Errorf("expected error to wrap %v, got %v", tt.wantErrIs, err)
				}
				if tt.wantNilResult && result != nil {
					t.Errorf("expected nil result, got %+v", result)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result == nil {
				t.Fatal("expected non-nil result")
			}
			if result.ID != tt.id {
				t.Errorf("expected ID %q, got %q", tt.id, result.ID)
			}
		})
	}
}

// --- UpdateOidcProviderUseCase ---

func TestUpdateOidcProviderUseCase_Execute(t *testing.T) {
	enabled := true

	tests := []struct {
		name        string
		input       domain.UpdateOidcProviderInput
		mockFn      func(ctx context.Context, input domain.UpdateOidcProviderInput) error
		wantErr     bool
		wantErrIs   error
		wantErrCode string
	}{
		{
			name: "success - update audience",
			input: domain.UpdateOidcProviderInput{
				ID:       "oidc-123",
				Audience: "new-audience",
			},
			mockFn: func(_ context.Context, _ domain.UpdateOidcProviderInput) error {
				return nil
			},
			wantErr: false,
		},
		{
			name: "success - update enabled",
			input: domain.UpdateOidcProviderInput{
				ID:      "oidc-123",
				Enabled: &enabled,
			},
			mockFn: func(_ context.Context, _ domain.UpdateOidcProviderInput) error {
				return nil
			},
			wantErr: false,
		},
		{
			name: "success - update allowed subjects",
			input: domain.UpdateOidcProviderInput{
				ID:              "oidc-123",
				AllowedSubjects: []string{"subject-1", "subject-2"},
			},
			mockFn: func(_ context.Context, _ domain.UpdateOidcProviderInput) error {
				return nil
			},
			wantErr: false,
		},
		{
			name: "validation error - empty ID",
			input: domain.UpdateOidcProviderInput{
				ID:       "",
				Audience: "new-audience",
			},
			mockFn:      nil,
			wantErr:     true,
			wantErrIs:   ErrProviderIDRequired,
			wantErrCode: OidcErrorCodeValidation,
		},
		{
			name: "validation error - whitespace ID",
			input: domain.UpdateOidcProviderInput{
				ID:       "   ",
				Audience: "new-audience",
			},
			mockFn:      nil,
			wantErr:     true,
			wantErrIs:   ErrProviderIDRequired,
			wantErrCode: OidcErrorCodeValidation,
		},
		{
			name: "service error",
			input: domain.UpdateOidcProviderInput{
				ID:       "oidc-123",
				Audience: "new-audience",
			},
			mockFn: func(_ context.Context, _ domain.UpdateOidcProviderInput) error {
				return errors.New("timeout")
			},
			wantErr:     true,
			wantErrCode: OidcErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &updateOidcProviderUseCase{
				service: &mockOidcService{updateProviderFn: tt.mockFn},
			}

			err := uc.Execute(context.Background(), tt.input)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var oidcErr *OidcError
				if !errors.As(err, &oidcErr) {
					t.Fatalf("expected *OidcError, got %T", err)
				}
				if oidcErr.Code != tt.wantErrCode {
					t.Errorf("expected error code %q, got %q", tt.wantErrCode, oidcErr.Code)
				}
				if tt.wantErrIs != nil && !errors.Is(err, tt.wantErrIs) {
					t.Errorf("expected error to wrap %v, got %v", tt.wantErrIs, err)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

// --- DeleteOidcProviderUseCase ---

func TestDeleteOidcProviderUseCase_Execute(t *testing.T) {
	tests := []struct {
		name        string
		id          string
		mockFn      func(ctx context.Context, id string) error
		wantErr     bool
		wantErrIs   error
		wantErrCode string
	}{
		{
			name: "success",
			id:   "oidc-123",
			mockFn: func(_ context.Context, _ string) error {
				return nil
			},
			wantErr: false,
		},
		{
			name:        "validation error - empty ID",
			id:          "",
			mockFn:      nil,
			wantErr:     true,
			wantErrIs:   ErrProviderIDRequired,
			wantErrCode: OidcErrorCodeValidation,
		},
		{
			name:        "validation error - whitespace ID",
			id:          "  \t  ",
			mockFn:      nil,
			wantErr:     true,
			wantErrIs:   ErrProviderIDRequired,
			wantErrCode: OidcErrorCodeValidation,
		},
		{
			name: "service error",
			id:   "oidc-123",
			mockFn: func(_ context.Context, _ string) error {
				return errors.New("permission denied")
			},
			wantErr:     true,
			wantErrCode: OidcErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &deleteOidcProviderUseCase{
				service: &mockOidcService{deleteProviderFn: tt.mockFn},
			}

			err := uc.Execute(context.Background(), tt.id)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var oidcErr *OidcError
				if !errors.As(err, &oidcErr) {
					t.Fatalf("expected *OidcError, got %T", err)
				}
				if oidcErr.Code != tt.wantErrCode {
					t.Errorf("expected error code %q, got %q", tt.wantErrCode, oidcErr.Code)
				}
				if tt.wantErrIs != nil && !errors.Is(err, tt.wantErrIs) {
					t.Errorf("expected error to wrap %v, got %v", tt.wantErrIs, err)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

// --- OidcError type tests ---

func TestOidcError_Error(t *testing.T) {
	tests := []struct {
		name     string
		err      OidcError
		expected string
	}{
		{
			name:     "without cause",
			err:      OidcError{Code: "TEST", Message: "something failed"},
			expected: "something failed",
		},
		{
			name:     "with cause",
			err:      OidcError{Code: "TEST", Message: "wrap", Cause: errors.New("root")},
			expected: "wrap: root",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.err.Error(); got != tt.expected {
				t.Errorf("expected %q, got %q", tt.expected, got)
			}
		})
	}
}

func TestOidcError_Unwrap(t *testing.T) {
	cause := errors.New("root cause")
	err := OidcError{Code: "TEST", Message: "wrap", Cause: cause}

	if err.Unwrap() != cause {
		t.Errorf("expected Unwrap() to return root cause")
	}

	errNoCause := OidcError{Code: "TEST", Message: "no cause"}
	if errNoCause.Unwrap() != nil {
		t.Errorf("expected Unwrap() to return nil when no cause")
	}
}

func TestOidcError_ErrorsIs(t *testing.T) {
	err := NewValidationError("validation failed", ErrProviderIDRequired)

	if !errors.Is(err, ErrProviderIDRequired) {
		t.Error("expected errors.Is to match ErrProviderIDRequired")
	}

	wrapped := fmt.Errorf("outer: %w", err)
	if !errors.Is(wrapped, ErrProviderIDRequired) {
		t.Error("expected nested errors.Is to match ErrProviderIDRequired")
	}
}

func TestNewValidationError(t *testing.T) {
	cause := errors.New("cause")
	err := NewValidationError("msg", cause)

	if err.Code != OidcErrorCodeValidation {
		t.Errorf("expected code %q, got %q", OidcErrorCodeValidation, err.Code)
	}
	if err.Message != "msg" {
		t.Errorf("expected message %q, got %q", "msg", err.Message)
	}
	if err.Cause != cause {
		t.Error("expected cause to match")
	}
}

func TestNewNotFoundError(t *testing.T) {
	err := NewNotFoundError("gone", nil)

	if err.Code != OidcErrorCodeNotFound {
		t.Errorf("expected code %q, got %q", OidcErrorCodeNotFound, err.Code)
	}
	if err.Cause != nil {
		t.Error("expected nil cause")
	}
}

func TestNewServiceError(t *testing.T) {
	cause := errors.New("db down")
	err := NewServiceError("svc fail", cause)

	if err.Code != OidcErrorCodeServiceError {
		t.Errorf("expected code %q, got %q", OidcErrorCodeServiceError, err.Code)
	}
	if !errors.Is(err, cause) {
		t.Error("expected errors.Is to match cause")
	}
}

// Test validateInput directly for edge cases not reachable through Execute
// (since the mock is nil when validation fails).
func TestCreateOidcProviderUseCase_validateInput(t *testing.T) {
	uc := &createOidcProviderUseCase{service: &mockOidcService{}}

	tests := []struct {
		name    string
		input   domain.CreateOidcProviderInput
		wantErr bool
	}{
		{
			name: "all valid - github_actions",
			input: domain.CreateOidcProviderInput{
				ProviderType: "github_actions",
				IssuerURL:    "https://token.actions.githubusercontent.com",
				Audience:     "envsync",
			},
			wantErr: false,
		},
		{
			name: "all valid - gitlab_ci",
			input: domain.CreateOidcProviderInput{
				ProviderType: "gitlab_ci",
				IssuerURL:    "https://gitlab.com",
				Audience:     "envsync",
			},
			wantErr: false,
		},
		{
			name: "all valid - kubernetes",
			input: domain.CreateOidcProviderInput{
				ProviderType: "kubernetes",
				IssuerURL:    "https://kubernetes.default.svc",
				Audience:     "envsync",
			},
			wantErr: false,
		},
		{
			name: "all valid - generic",
			input: domain.CreateOidcProviderInput{
				ProviderType: "generic",
				IssuerURL:    "https://accounts.google.com",
				Audience:     "envsync",
			},
			wantErr: false,
		},
		{
			name: "invalid type - empty",
			input: domain.CreateOidcProviderInput{
				ProviderType: "",
				IssuerURL:    "https://example.com",
				Audience:     "envsync",
			},
			wantErr: true,
		},
		{
			name: "invalid type - unknown",
			input: domain.CreateOidcProviderInput{
				ProviderType: "azure_devops",
				IssuerURL:    "https://example.com",
				Audience:     "envsync",
			},
			wantErr: true,
		},
		{
			name: "missing issuer URL",
			input: domain.CreateOidcProviderInput{
				ProviderType: "github_actions",
				IssuerURL:    "",
				Audience:     "envsync",
			},
			wantErr: true,
		},
		{
			name: "missing audience",
			input: domain.CreateOidcProviderInput{
				ProviderType: "github_actions",
				IssuerURL:    "https://example.com",
				Audience:     "",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := uc.validateInput(tt.input)
			if tt.wantErr && err == nil {
				t.Error("expected error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}
