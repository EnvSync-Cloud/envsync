package saml

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
)

// Ensure mockSamlService satisfies the interface at compile time.
var _ services.SamlService = (*mockSamlService)(nil)

type mockSamlService struct {
	createProviderFn func(ctx context.Context, input domain.CreateSamlProviderInput) (*domain.SamlProvider, error)
	listProvidersFn  func(ctx context.Context) ([]domain.SamlProvider, error)
	getProviderFn    func(ctx context.Context, id string) (*domain.SamlProvider, error)
	updateProviderFn func(ctx context.Context, input domain.UpdateSamlProviderInput) error
	deleteProviderFn func(ctx context.Context, id string) error
	getMetadataFn    func(ctx context.Context, id string) error
	initiateSsoFn    func(ctx context.Context, providerID string) (*domain.SamlSsoResult, error)
}

func (m *mockSamlService) CreateProvider(ctx context.Context, input domain.CreateSamlProviderInput) (*domain.SamlProvider, error) {
	return m.createProviderFn(ctx, input)
}

func (m *mockSamlService) ListProviders(ctx context.Context) ([]domain.SamlProvider, error) {
	return m.listProvidersFn(ctx)
}

func (m *mockSamlService) GetProvider(ctx context.Context, id string) (*domain.SamlProvider, error) {
	return m.getProviderFn(ctx, id)
}

func (m *mockSamlService) UpdateProvider(ctx context.Context, input domain.UpdateSamlProviderInput) error {
	return m.updateProviderFn(ctx, input)
}

func (m *mockSamlService) DeleteProvider(ctx context.Context, id string) error {
	return m.deleteProviderFn(ctx, id)
}

func (m *mockSamlService) GetMetadata(ctx context.Context, id string) error {
	return m.getMetadataFn(ctx, id)
}

func (m *mockSamlService) InitiateSso(ctx context.Context, providerID string) (*domain.SamlSsoResult, error) {
	return m.initiateSsoFn(ctx, providerID)
}

// --- CreateSamlProviderUseCase ---

func TestCreateSamlProviderUseCase_Execute(t *testing.T) {
	tests := []struct {
		name          string
		input         domain.CreateSamlProviderInput
		mockFn        func(ctx context.Context, input domain.CreateSamlProviderInput) (*domain.SamlProvider, error)
		wantErr       bool
		wantErrIs     error
		wantErrCode   string
		wantNilResult bool
	}{
		{
			name: "success with okta",
			input: domain.CreateSamlProviderInput{
				ProviderType: "okta",
				Name:         "Okta SSO",
				EntityID:     "http://www.okta.com/exk123",
				SsoURL:       "https://dev-123.okta.com/app/exk123/sso/saml",
				Certificate:  "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----",
			},
			mockFn: func(_ context.Context, input domain.CreateSamlProviderInput) (*domain.SamlProvider, error) {
				return &domain.SamlProvider{
					ID:           "saml-123",
					ProviderType: input.ProviderType,
					Name:         input.Name,
					EntityID:     input.EntityID,
					SsoURL:       input.SsoURL,
					Enabled:      true,
				}, nil
			},
			wantErr: false,
		},
		{
			name: "success with azure-ad",
			input: domain.CreateSamlProviderInput{
				ProviderType: "azure-ad",
				Name:         "Azure AD SSO",
				EntityID:     "https://sts.windows.net/tenant-id/",
				SsoURL:       "https://login.microsoftonline.com/tenant-id/saml2",
				Certificate:  "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----",
			},
			mockFn: func(_ context.Context, _ domain.CreateSamlProviderInput) (*domain.SamlProvider, error) {
				return &domain.SamlProvider{ID: "saml-azure", ProviderType: "azure-ad"}, nil
			},
			wantErr: false,
		},
		{
			name: "success with onelogin",
			input: domain.CreateSamlProviderInput{
				ProviderType: "onelogin",
				Name:         "OneLogin SSO",
				EntityID:     "https://app.onelogin.com/saml/metadata/123",
				SsoURL:       "https://app.onelogin.com/trust/saml2/http-post/sso/123",
				Certificate:  "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----",
			},
			mockFn: func(_ context.Context, _ domain.CreateSamlProviderInput) (*domain.SamlProvider, error) {
				return &domain.SamlProvider{ID: "saml-ol"}, nil
			},
			wantErr: false,
		},
		{
			name: "success with google-workspace",
			input: domain.CreateSamlProviderInput{
				ProviderType: "google-workspace",
				Name:         "Google Workspace",
				EntityID:     "google.com",
				SsoURL:       "https://accounts.google.com/o/saml2/idp",
				Certificate:  "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----",
			},
			mockFn: func(_ context.Context, _ domain.CreateSamlProviderInput) (*domain.SamlProvider, error) {
				return &domain.SamlProvider{ID: "saml-google"}, nil
			},
			wantErr: false,
		},
		{
			name: "success with duo",
			input: domain.CreateSamlProviderInput{
				ProviderType: "duo",
				Name:         "Duo SSO",
				EntityID:     "https://sso.duo.com",
				SsoURL:       "https://sso.duo.com/saml",
				Certificate:  "cert",
			},
			mockFn: func(_ context.Context, _ domain.CreateSamlProviderInput) (*domain.SamlProvider, error) {
				return &domain.SamlProvider{ID: "saml-duo"}, nil
			},
			wantErr: false,
		},
		{
			name: "success with rippling",
			input: domain.CreateSamlProviderInput{
				ProviderType: "rippling",
				Name:         "Rippling SSO",
				EntityID:     "https://rippling.com",
				SsoURL:       "https://rippling.com/saml/sso",
				Certificate:  "cert",
			},
			mockFn: func(_ context.Context, _ domain.CreateSamlProviderInput) (*domain.SamlProvider, error) {
				return &domain.SamlProvider{ID: "saml-rip"}, nil
			},
			wantErr: false,
		},
		{
			name: "validation error - empty provider type",
			input: domain.CreateSamlProviderInput{
				ProviderType: "",
				Name:         "Test",
				EntityID:     "entity",
				SsoURL:       "https://sso.example.com",
				Certificate:  "cert",
			},
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrProviderTypeRequired,
			wantErrCode:   SamlErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name: "validation error - whitespace provider type",
			input: domain.CreateSamlProviderInput{
				ProviderType: "   ",
				Name:         "Test",
				EntityID:     "entity",
				SsoURL:       "https://sso.example.com",
				Certificate:  "cert",
			},
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrProviderTypeRequired,
			wantErrCode:   SamlErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name: "validation error - empty name",
			input: domain.CreateSamlProviderInput{
				ProviderType: "okta",
				Name:         "",
				EntityID:     "entity",
				SsoURL:       "https://sso.example.com",
				Certificate:  "cert",
			},
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrNameRequired,
			wantErrCode:   SamlErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name: "validation error - empty entity ID",
			input: domain.CreateSamlProviderInput{
				ProviderType: "okta",
				Name:         "Test",
				EntityID:     "",
				SsoURL:       "https://sso.example.com",
				Certificate:  "cert",
			},
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrEntityIDRequired,
			wantErrCode:   SamlErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name: "validation error - empty SSO URL",
			input: domain.CreateSamlProviderInput{
				ProviderType: "okta",
				Name:         "Test",
				EntityID:     "entity",
				SsoURL:       "",
				Certificate:  "cert",
			},
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrSsoURLRequired,
			wantErrCode:   SamlErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name: "validation error - empty certificate",
			input: domain.CreateSamlProviderInput{
				ProviderType: "okta",
				Name:         "Test",
				EntityID:     "entity",
				SsoURL:       "https://sso.example.com",
				Certificate:  "",
			},
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrCertificateRequired,
			wantErrCode:   SamlErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name: "validation error - invalid provider type",
			input: domain.CreateSamlProviderInput{
				ProviderType: "auth0",
				Name:         "Test",
				EntityID:     "entity",
				SsoURL:       "https://sso.example.com",
				Certificate:  "cert",
			},
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrInvalidProviderType,
			wantErrCode:   SamlErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name: "service error",
			input: domain.CreateSamlProviderInput{
				ProviderType: "okta",
				Name:         "Test",
				EntityID:     "entity",
				SsoURL:       "https://sso.example.com",
				Certificate:  "cert",
			},
			mockFn: func(_ context.Context, _ domain.CreateSamlProviderInput) (*domain.SamlProvider, error) {
				return nil, errors.New("network error")
			},
			wantErr:       true,
			wantErrCode:   SamlErrorCodeServiceError,
			wantNilResult: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &createSamlProviderUseCase{
				service: &mockSamlService{createProviderFn: tt.mockFn},
			}

			result, err := uc.Execute(context.Background(), tt.input)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var samlErr *SamlError
				if !errors.As(err, &samlErr) {
					t.Fatalf("expected *SamlError, got %T", err)
				}
				if samlErr.Code != tt.wantErrCode {
					t.Errorf("expected error code %q, got %q", tt.wantErrCode, samlErr.Code)
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

// --- ListSamlProvidersUseCase ---

func TestListSamlProvidersUseCase_Execute(t *testing.T) {
	tests := []struct {
		name        string
		mockFn      func(ctx context.Context) ([]domain.SamlProvider, error)
		wantErr     bool
		wantErrCode string
		wantCount   int
	}{
		{
			name: "success - empty list",
			mockFn: func(_ context.Context) ([]domain.SamlProvider, error) {
				return []domain.SamlProvider{}, nil
			},
			wantCount: 0,
		},
		{
			name: "success - multiple providers",
			mockFn: func(_ context.Context) ([]domain.SamlProvider, error) {
				return []domain.SamlProvider{
					{ID: "saml-1", ProviderType: "okta", Name: "Okta"},
					{ID: "saml-2", ProviderType: "azure-ad", Name: "Azure"},
					{ID: "saml-3", ProviderType: "onelogin", Name: "OneLogin"},
				}, nil
			},
			wantCount: 3,
		},
		{
			name: "service error",
			mockFn: func(_ context.Context) ([]domain.SamlProvider, error) {
				return nil, errors.New("connection refused")
			},
			wantErr:     true,
			wantErrCode: SamlErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &listSamlProvidersUseCase{
				service: &mockSamlService{listProvidersFn: tt.mockFn},
			}

			result, err := uc.Execute(context.Background())

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var samlErr *SamlError
				if !errors.As(err, &samlErr) {
					t.Fatalf("expected *SamlError, got %T", err)
				}
				if samlErr.Code != tt.wantErrCode {
					t.Errorf("expected error code %q, got %q", tt.wantErrCode, samlErr.Code)
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

// --- GetSamlProviderUseCase ---

func TestGetSamlProviderUseCase_Execute(t *testing.T) {
	tests := []struct {
		name          string
		id            string
		mockFn        func(ctx context.Context, id string) (*domain.SamlProvider, error)
		wantErr       bool
		wantErrIs     error
		wantErrCode   string
		wantNilResult bool
	}{
		{
			name: "success",
			id:   "saml-123",
			mockFn: func(_ context.Context, id string) (*domain.SamlProvider, error) {
				return &domain.SamlProvider{
					ID:           id,
					ProviderType: "okta",
					Name:         "Okta SSO",
					EntityID:     "http://www.okta.com/exk123",
					Enabled:      true,
				}, nil
			},
		},
		{
			name:          "validation error - empty ID",
			id:            "",
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrProviderIDRequired,
			wantErrCode:   SamlErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name:          "validation error - whitespace ID",
			id:            "   \t  ",
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrProviderIDRequired,
			wantErrCode:   SamlErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name: "service error",
			id:   "saml-nonexistent",
			mockFn: func(_ context.Context, _ string) (*domain.SamlProvider, error) {
				return nil, errors.New("not found")
			},
			wantErr:       true,
			wantErrCode:   SamlErrorCodeServiceError,
			wantNilResult: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &getSamlProviderUseCase{
				service: &mockSamlService{getProviderFn: tt.mockFn},
			}

			result, err := uc.Execute(context.Background(), tt.id)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var samlErr *SamlError
				if !errors.As(err, &samlErr) {
					t.Fatalf("expected *SamlError, got %T", err)
				}
				if samlErr.Code != tt.wantErrCode {
					t.Errorf("expected error code %q, got %q", tt.wantErrCode, samlErr.Code)
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

// --- UpdateSamlProviderUseCase ---

func TestUpdateSamlProviderUseCase_Execute(t *testing.T) {
	enabled := true

	tests := []struct {
		name        string
		input       domain.UpdateSamlProviderInput
		mockFn      func(ctx context.Context, input domain.UpdateSamlProviderInput) error
		wantErr     bool
		wantErrIs   error
		wantErrCode string
	}{
		{
			name: "success - update name",
			input: domain.UpdateSamlProviderInput{
				ID:   "saml-123",
				Name: "Updated Name",
			},
			mockFn: func(_ context.Context, _ domain.UpdateSamlProviderInput) error {
				return nil
			},
		},
		{
			name: "success - update multiple fields",
			input: domain.UpdateSamlProviderInput{
				ID:          "saml-123",
				Name:        "New Name",
				EntityID:    "new-entity",
				SsoURL:      "https://new-sso.example.com",
				Certificate: "new-cert",
			},
			mockFn: func(_ context.Context, _ domain.UpdateSamlProviderInput) error {
				return nil
			},
		},
		{
			name: "success - disable provider",
			input: domain.UpdateSamlProviderInput{
				ID:      "saml-123",
				Enabled: &enabled,
			},
			mockFn: func(_ context.Context, _ domain.UpdateSamlProviderInput) error {
				return nil
			},
		},
		{
			name: "validation error - empty ID",
			input: domain.UpdateSamlProviderInput{
				ID:   "",
				Name: "Updated",
			},
			mockFn:      nil,
			wantErr:     true,
			wantErrIs:   ErrProviderIDRequired,
			wantErrCode: SamlErrorCodeValidation,
		},
		{
			name: "validation error - whitespace ID",
			input: domain.UpdateSamlProviderInput{
				ID:   "   ",
				Name: "Updated",
			},
			mockFn:      nil,
			wantErr:     true,
			wantErrIs:   ErrProviderIDRequired,
			wantErrCode: SamlErrorCodeValidation,
		},
		{
			name: "service error",
			input: domain.UpdateSamlProviderInput{
				ID:   "saml-123",
				Name: "Updated",
			},
			mockFn: func(_ context.Context, _ domain.UpdateSamlProviderInput) error {
				return errors.New("timeout")
			},
			wantErr:     true,
			wantErrCode: SamlErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &updateSamlProviderUseCase{
				service: &mockSamlService{updateProviderFn: tt.mockFn},
			}

			err := uc.Execute(context.Background(), tt.input)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var samlErr *SamlError
				if !errors.As(err, &samlErr) {
					t.Fatalf("expected *SamlError, got %T", err)
				}
				if samlErr.Code != tt.wantErrCode {
					t.Errorf("expected error code %q, got %q", tt.wantErrCode, samlErr.Code)
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

// --- DeleteSamlProviderUseCase ---

func TestDeleteSamlProviderUseCase_Execute(t *testing.T) {
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
			id:   "saml-123",
			mockFn: func(_ context.Context, _ string) error {
				return nil
			},
		},
		{
			name:        "validation error - empty ID",
			id:          "",
			mockFn:      nil,
			wantErr:     true,
			wantErrIs:   ErrProviderIDRequired,
			wantErrCode: SamlErrorCodeValidation,
		},
		{
			name:        "validation error - whitespace ID",
			id:          "  \t  ",
			mockFn:      nil,
			wantErr:     true,
			wantErrIs:   ErrProviderIDRequired,
			wantErrCode: SamlErrorCodeValidation,
		},
		{
			name: "service error",
			id:   "saml-123",
			mockFn: func(_ context.Context, _ string) error {
				return errors.New("permission denied")
			},
			wantErr:     true,
			wantErrCode: SamlErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &deleteSamlProviderUseCase{
				service: &mockSamlService{deleteProviderFn: tt.mockFn},
			}

			err := uc.Execute(context.Background(), tt.id)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var samlErr *SamlError
				if !errors.As(err, &samlErr) {
					t.Fatalf("expected *SamlError, got %T", err)
				}
				if samlErr.Code != tt.wantErrCode {
					t.Errorf("expected error code %q, got %q", tt.wantErrCode, samlErr.Code)
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

// --- GetSamlMetadataUseCase ---

func TestGetSamlMetadataUseCase_Execute(t *testing.T) {
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
			id:   "saml-123",
			mockFn: func(_ context.Context, _ string) error {
				return nil
			},
		},
		{
			name:        "validation error - empty ID",
			id:          "",
			mockFn:      nil,
			wantErr:     true,
			wantErrIs:   ErrProviderIDRequired,
			wantErrCode: SamlErrorCodeValidation,
		},
		{
			name:        "validation error - whitespace ID",
			id:          "   \t ",
			mockFn:      nil,
			wantErr:     true,
			wantErrIs:   ErrProviderIDRequired,
			wantErrCode: SamlErrorCodeValidation,
		},
		{
			name: "service error",
			id:   "saml-123",
			mockFn: func(_ context.Context, _ string) error {
				return errors.New("metadata fetch failed")
			},
			wantErr:     true,
			wantErrCode: SamlErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &getSamlMetadataUseCase{
				service: &mockSamlService{getMetadataFn: tt.mockFn},
			}

			err := uc.Execute(context.Background(), tt.id)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var samlErr *SamlError
				if !errors.As(err, &samlErr) {
					t.Fatalf("expected *SamlError, got %T", err)
				}
				if samlErr.Code != tt.wantErrCode {
					t.Errorf("expected error code %q, got %q", tt.wantErrCode, samlErr.Code)
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

// --- InitiateSamlSsoUseCase ---

func TestInitiateSamlSsoUseCase_Execute(t *testing.T) {
	tests := []struct {
		name          string
		providerID    string
		mockFn        func(ctx context.Context, providerID string) (*domain.SamlSsoResult, error)
		wantErr       bool
		wantErrIs     error
		wantErrCode   string
		wantNilResult bool
	}{
		{
			name:       "success",
			providerID: "saml-123",
			mockFn: func(_ context.Context, providerID string) (*domain.SamlSsoResult, error) {
				return &domain.SamlSsoResult{
					RedirectURL: "https://idp.example.com/sso?SAMLRequest=...",
					RequestID:   "req-abc123",
				}, nil
			},
		},
		{
			name:          "validation error - empty provider ID",
			providerID:    "",
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrProviderIDRequired,
			wantErrCode:   SamlErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name:          "validation error - whitespace provider ID",
			providerID:    "   \t  ",
			mockFn:        nil,
			wantErr:       true,
			wantErrIs:     ErrProviderIDRequired,
			wantErrCode:   SamlErrorCodeValidation,
			wantNilResult: true,
		},
		{
			name:       "service error",
			providerID: "saml-123",
			mockFn: func(_ context.Context, _ string) (*domain.SamlSsoResult, error) {
				return nil, errors.New("SSO initiation failed")
			},
			wantErr:       true,
			wantErrCode:   SamlErrorCodeServiceError,
			wantNilResult: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &initiateSamlSsoUseCase{
				service: &mockSamlService{initiateSsoFn: tt.mockFn},
			}

			result, err := uc.Execute(context.Background(), tt.providerID)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var samlErr *SamlError
				if !errors.As(err, &samlErr) {
					t.Fatalf("expected *SamlError, got %T", err)
				}
				if samlErr.Code != tt.wantErrCode {
					t.Errorf("expected error code %q, got %q", tt.wantErrCode, samlErr.Code)
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
			if result.RedirectURL == "" {
				t.Error("expected non-empty RedirectURL")
			}
			if result.RequestID == "" {
				t.Error("expected non-empty RequestID")
			}
		})
	}
}

// --- SamlError type tests ---

func TestSamlError_Error(t *testing.T) {
	tests := []struct {
		name     string
		err      SamlError
		expected string
	}{
		{
			name:     "without cause",
			err:      SamlError{Code: "TEST", Message: "something failed"},
			expected: "something failed",
		},
		{
			name:     "with cause",
			err:      SamlError{Code: "TEST", Message: "wrap", Cause: errors.New("root")},
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

func TestSamlError_Unwrap(t *testing.T) {
	cause := errors.New("root cause")
	err := SamlError{Code: "TEST", Message: "wrap", Cause: cause}

	if err.Unwrap() != cause {
		t.Errorf("expected Unwrap() to return root cause")
	}

	errNoCause := SamlError{Code: "TEST", Message: "no cause"}
	if errNoCause.Unwrap() != nil {
		t.Errorf("expected Unwrap() to return nil when no cause")
	}
}

func TestSamlError_ErrorsIs(t *testing.T) {
	err := NewValidationError("validation failed", ErrProviderIDRequired)

	if !errors.Is(err, ErrProviderIDRequired) {
		t.Error("expected errors.Is to match ErrProviderIDRequired")
	}

	wrapped := fmt.Errorf("outer: %w", err)
	if !errors.Is(wrapped, ErrProviderIDRequired) {
		t.Error("expected nested errors.Is to match ErrProviderIDRequired")
	}
}

func TestSamlNewValidationError(t *testing.T) {
	cause := errors.New("cause")
	err := NewValidationError("msg", cause)

	if err.Code != SamlErrorCodeValidation {
		t.Errorf("expected code %q, got %q", SamlErrorCodeValidation, err.Code)
	}
	if err.Message != "msg" {
		t.Errorf("expected message %q, got %q", "msg", err.Message)
	}
	if err.Cause != cause {
		t.Error("expected cause to match")
	}
}

func TestSamlNewNotFoundError(t *testing.T) {
	err := NewNotFoundError("gone", nil)

	if err.Code != SamlErrorCodeNotFound {
		t.Errorf("expected code %q, got %q", SamlErrorCodeNotFound, err.Code)
	}
	if err.Cause != nil {
		t.Error("expected nil cause")
	}
}

func TestSamlNewServiceError(t *testing.T) {
	cause := errors.New("db down")
	err := NewServiceError("svc fail", cause)

	if err.Code != SamlErrorCodeServiceError {
		t.Errorf("expected code %q, got %q", SamlErrorCodeServiceError, err.Code)
	}
	if !errors.Is(err, cause) {
		t.Error("expected errors.Is to match cause")
	}
}

// Test validateInput directly for edge cases not reachable through Execute.
func TestCreateSamlProviderUseCase_validateInput(t *testing.T) {
	uc := &createSamlProviderUseCase{service: &mockSamlService{}}

	tests := []struct {
		name    string
		input   domain.CreateSamlProviderInput
		wantErr bool
	}{
		{
			name: "all valid - okta",
			input: domain.CreateSamlProviderInput{
				ProviderType: "okta",
				Name:         "Okta SSO",
				EntityID:     "entity",
				SsoURL:       "https://sso.example.com",
				Certificate:  "cert",
			},
			wantErr: false,
		},
		{
			name: "all valid - azure-ad",
			input: domain.CreateSamlProviderInput{
				ProviderType: "azure-ad",
				Name:         "Azure AD",
				EntityID:     "entity",
				SsoURL:       "https://sso.example.com",
				Certificate:  "cert",
			},
			wantErr: false,
		},
		{
			name: "all valid - onelogin",
			input: domain.CreateSamlProviderInput{
				ProviderType: "onelogin",
				Name:         "OneLogin",
				EntityID:     "entity",
				SsoURL:       "https://sso.example.com",
				Certificate:  "cert",
			},
			wantErr: false,
		},
		{
			name: "all valid - google-workspace",
			input: domain.CreateSamlProviderInput{
				ProviderType: "google-workspace",
				Name:         "Google",
				EntityID:     "entity",
				SsoURL:       "https://sso.example.com",
				Certificate:  "cert",
			},
			wantErr: false,
		},
		{
			name: "all valid - duo",
			input: domain.CreateSamlProviderInput{
				ProviderType: "duo",
				Name:         "Duo",
				EntityID:     "entity",
				SsoURL:       "https://sso.example.com",
				Certificate:  "cert",
			},
			wantErr: false,
		},
		{
			name: "all valid - rippling",
			input: domain.CreateSamlProviderInput{
				ProviderType: "rippling",
				Name:         "Rippling",
				EntityID:     "entity",
				SsoURL:       "https://sso.example.com",
				Certificate:  "cert",
			},
			wantErr: false,
		},
		{
			name: "all valid - oracle",
			input: domain.CreateSamlProviderInput{
				ProviderType: "oracle",
				Name:         "Oracle",
				EntityID:     "entity",
				SsoURL:       "https://sso.example.com",
				Certificate:  "cert",
			},
			wantErr: false,
		},
		{
			name: "all valid - ping-identity",
			input: domain.CreateSamlProviderInput{
				ProviderType: "ping-identity",
				Name:         "Ping",
				EntityID:     "entity",
				SsoURL:       "https://sso.example.com",
				Certificate:  "cert",
			},
			wantErr: false,
		},
		{
			name: "invalid type - unknown",
			input: domain.CreateSamlProviderInput{
				ProviderType: "auth0",
				Name:         "Auth0",
				EntityID:     "entity",
				SsoURL:       "https://sso.example.com",
				Certificate:  "cert",
			},
			wantErr: true,
		},
		{
			name: "missing name",
			input: domain.CreateSamlProviderInput{
				ProviderType: "okta",
				Name:         "",
				EntityID:     "entity",
				SsoURL:       "https://sso.example.com",
				Certificate:  "cert",
			},
			wantErr: true,
		},
		{
			name: "missing entity ID",
			input: domain.CreateSamlProviderInput{
				ProviderType: "okta",
				Name:         "Test",
				EntityID:     "",
				SsoURL:       "https://sso.example.com",
				Certificate:  "cert",
			},
			wantErr: true,
		},
		{
			name: "missing SSO URL",
			input: domain.CreateSamlProviderInput{
				ProviderType: "okta",
				Name:         "Test",
				EntityID:     "entity",
				SsoURL:       "",
				Certificate:  "cert",
			},
			wantErr: true,
		},
		{
			name: "missing certificate",
			input: domain.CreateSamlProviderInput{
				ProviderType: "okta",
				Name:         "Test",
				EntityID:     "entity",
				SsoURL:       "https://sso.example.com",
				Certificate:  "",
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
