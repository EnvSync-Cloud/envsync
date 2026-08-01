package formatters

import (
	"bytes"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	managementsdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
)

// ---------------------------------------------------------------------------
// BaseFormatter tests (inherited by all formatters)
// ---------------------------------------------------------------------------

func TestBaseFormatter_FormatJSON(t *testing.T) {
	f := NewBaseFormatter()

	tests := []struct {
		name      string
		data      any
		wantKey   string
		wantErr   bool
	}{
		{
			name:    "map data",
			data:    map[string]string{"key": "value"},
			wantKey: `"key"`,
		},
		{
			name:    "struct data",
			data:    struct{ Name string }{Name: "test"},
			wantKey: `"Name"`,
		},
		{
			name:    "slice data",
			data:    []string{"a", "b"},
			wantKey: `"a"`,
		},
		{
			name:    "nil data",
			data:    nil,
			wantKey: "null",
		},
		{
			name:    "empty map",
			data:    map[string]string{},
			wantKey: "{}",
		},
		{
			name:    "nested data",
			data:    map[string]any{"nested": map[string]int{"count": 42}},
			wantKey: `"count"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatJSON(&buf, tt.data)
			if (err != nil) != tt.wantErr {
				t.Errorf("FormatJSON() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			output := buf.String()
			if !strings.Contains(output, tt.wantKey) {
				t.Errorf("FormatJSON() output = %q, want it to contain %q", output, tt.wantKey)
			}
			// Verify valid JSON
			if err := json.Unmarshal([]byte(output), new(any)); err != nil {
				t.Errorf("FormatJSON() produced invalid JSON: %v", err)
			}
		})
	}
}

func TestBaseFormatter_FormatJSONError(t *testing.T) {
	f := NewBaseFormatter()

	tests := []struct {
		name    string
		err     error
		wantMsg string
	}{
		{
			name:    "simple error",
			err:     errors.New("something failed"),
			wantMsg: "something failed",
		},
		{
			name:    "error with special characters",
			err:     errors.New("failed to connect: \"host\" not found"),
			wantMsg: "failed to connect",
		},
		{
			name:    "empty error message",
			err:     errors.New(""),
			wantMsg: `"error"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatJSONError(&buf, tt.err)
			if err != nil {
				t.Fatalf("FormatJSONError() error = %v", err)
			}
			output := buf.String()
			if !strings.Contains(output, tt.wantMsg) {
				t.Errorf("FormatJSONError() output = %q, want it to contain %q", output, tt.wantMsg)
			}
			// Verify it's valid JSON with an "error" key
			var parsed map[string]string
			if err := json.Unmarshal([]byte(output), &parsed); err != nil {
				t.Fatalf("FormatJSONError() produced invalid JSON: %v", err)
			}
			if _, ok := parsed["error"]; !ok {
				t.Error("FormatJSONError() JSON should have 'error' key")
			}
		})
	}
}

func TestBaseFormatter_FormatWarningJSON(t *testing.T) {
	f := NewBaseFormatter()

	tests := []struct {
		name    string
		message string
	}{
		{
			name:    "simple warning",
			message: "secrets are enabled but no public key was provided",
		},
		{
			name:    "empty message",
			message: "",
		},
		{
			name:    "message with special characters",
			message: "⚠️ warning: \"quotes\" and <angles>",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatWarningJSON(&buf, tt.message)
			if err != nil {
				t.Fatalf("FormatWarningJSON() error = %v", err)
			}
			output := buf.String()
			var parsed map[string]string
			if err := json.Unmarshal([]byte(output), &parsed); err != nil {
				t.Fatalf("FormatWarningJSON() produced invalid JSON: %v", err)
			}
			if parsed["warning"] != tt.message {
				t.Errorf("FormatWarningJSON() warning = %q, want %q", parsed["warning"], tt.message)
			}
		})
	}
}

func TestBaseFormatter_FormatSuccess(t *testing.T) {
	f := NewBaseFormatter()

	tests := []struct {
		name    string
		message string
	}{
		{name: "simple", message: "Operation completed"},
		{name: "empty", message: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatSuccess(&buf, tt.message)
			if err != nil {
				t.Fatalf("FormatSuccess() error = %v", err)
			}
			output := buf.String()
			if len(output) == 0 {
				t.Error("FormatSuccess() produced empty output")
			}
			if !strings.Contains(output, tt.message) {
				t.Errorf("FormatSuccess() output = %q, want it to contain %q", output, tt.message)
			}
		})
	}
}

func TestBaseFormatter_FormatError(t *testing.T) {
	f := NewBaseFormatter()

	tests := []struct {
		name    string
		message string
	}{
		{name: "simple", message: "Something went wrong"},
		{name: "empty", message: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatError(&buf, tt.message)
			if err != nil {
				t.Fatalf("FormatError() error = %v", err)
			}
			output := buf.String()
			if len(output) == 0 {
				t.Error("FormatError() produced empty output")
			}
			if !strings.Contains(output, tt.message) {
				t.Errorf("FormatError() output = %q, want it to contain %q", output, tt.message)
			}
		})
	}
}

func TestBaseFormatter_FormatWarning(t *testing.T) {
	f := NewBaseFormatter()

	tests := []struct {
		name    string
		message string
	}{
		{name: "simple", message: "This is a warning"},
		{name: "empty", message: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatWarning(&buf, tt.message)
			if err != nil {
				t.Fatalf("FormatWarning() error = %v", err)
			}
			output := buf.String()
			if len(output) == 0 {
				t.Error("FormatWarning() produced empty output")
			}
			if !strings.Contains(output, tt.message) {
				t.Errorf("FormatWarning() output = %q, want it to contain %q", output, tt.message)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// ServiceTokenFormatter tests
// ---------------------------------------------------------------------------

func TestServiceTokenFormatter_FormatCreateSuccessMessage(t *testing.T) {
	f := NewServiceTokenFormatter()
	appID := "app-123"
	envTypeID := "env-456"

	tests := []struct {
		name     string
		token    *sdk.CreateServiceTokenResponse
		wantText []string
	}{
		{
			name: "full token with all fields",
			token: &sdk.CreateServiceTokenResponse{
				Id:        "tok-001",
				Token:     "secret-token-value",
				Name:      "my-token",
				AppId:     &appID,
				EnvTypeId: &envTypeID,
				Permissions: &sdk.ServiceTokenPermissions{
					Read:  true,
					Write: false,
				},
				ExpiresAt: "2025-12-31T23:59:59Z",
				CreatedAt: "2025-01-01T00:00:00Z",
			},
			wantText: []string{"my-token", "tok-001", "secret-token-value", "app-123", "env-456", "true", "false"},
		},
		{
			name: "minimal token without optional fields",
			token: &sdk.CreateServiceTokenResponse{
				Id:        "tok-002",
				Token:     "another-token",
				Name:      "minimal-token",
				ExpiresAt: "2025-06-30T00:00:00Z",
				CreatedAt: "2025-01-15T00:00:00Z",
			},
			wantText: []string{"minimal-token", "tok-002", "another-token"},
		},
		{
			name: "token with nil permissions",
			token: &sdk.CreateServiceTokenResponse{
				Id:        "tok-003",
				Token:     "no-perms-token",
				Name:      "no-perms",
				ExpiresAt: "2025-03-01T00:00:00Z",
				CreatedAt: "2025-01-01T00:00:00Z",
			},
			wantText: []string{"no-perms", "tok-003"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatCreateSuccessMessage(&buf, tt.token)
			if err != nil {
				t.Fatalf("FormatCreateSuccessMessage() error = %v", err)
			}
			output := buf.String()
			for _, text := range tt.wantText {
				if !strings.Contains(output, text) {
					t.Errorf("output = %q, want it to contain %q", output, text)
				}
			}
		})
	}
}

func TestServiceTokenFormatter_FormatGetSuccessMessage(t *testing.T) {
	f := NewServiceTokenFormatter()
	appID := "app-789"
	lastUsed := "2025-06-01T12:00:00Z"

	tests := []struct {
		name     string
		token    *sdk.ServiceTokenResponse
		wantText []string
	}{
		{
			name: "full token details",
			token: &sdk.ServiceTokenResponse{
				Id:         "tok-100",
				Name:       "detail-token",
				AppId:      &appID,
				Permissions: &sdk.ServiceTokenPermissions{Read: true, Write: true},
				ExpiresAt:  "2025-12-31T00:00:00Z",
				LastUsedAt: &lastUsed,
				CreatedAt:  "2025-01-01T00:00:00Z",
			},
			wantText: []string{"detail-token", "tok-100", "app-789", "true", "2025-06-01T12:00:00Z"},
		},
		{
			name: "token without optional fields",
			token: &sdk.ServiceTokenResponse{
				Id:        "tok-200",
				Name:      "simple-token",
				ExpiresAt: "2025-06-01T00:00:00Z",
				CreatedAt: "2025-01-01T00:00:00Z",
			},
			wantText: []string{"simple-token", "tok-200"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatGetSuccessMessage(&buf, tt.token)
			if err != nil {
				t.Fatalf("FormatGetSuccessMessage() error = %v", err)
			}
			output := buf.String()
			for _, text := range tt.wantText {
				if !strings.Contains(output, text) {
					t.Errorf("output = %q, want it to contain %q", output, text)
				}
			}
		})
	}
}

func TestServiceTokenFormatter_FormatListTable(t *testing.T) {
	f := NewServiceTokenFormatter()

	tests := []struct {
		name     string
		tokens   sdk.ServiceTokensResponse
		wantText []string
	}{
		{
			name:   "empty list",
			tokens: sdk.ServiceTokensResponse{},
			wantText: []string{"ID", "NAME", "EXPIRES AT"},
		},
		{
			name: "single token",
			tokens: sdk.ServiceTokensResponse{
				&sdk.ServiceTokenResponse{
					Id:        "tok-1",
					Name:      "token-one",
					ExpiresAt: "2025-12-31",
					CreatedAt: "2025-01-01",
					Permissions: &sdk.ServiceTokenPermissions{Read: true, Write: false},
				},
			},
			wantText: []string{"tok-1", "token-one", "2025-12-31", "true", "false"},
		},
		{
			name: "multiple tokens with nil optional fields",
			tokens: sdk.ServiceTokensResponse{
				&sdk.ServiceTokenResponse{
					Id: "t1", Name: "first", ExpiresAt: "2025-06-01", CreatedAt: "2025-01-01",
				},
				&sdk.ServiceTokenResponse{
					Id: "t2", Name: "second", ExpiresAt: "2025-07-01", CreatedAt: "2025-02-01",
				},
			},
			wantText: []string{"t1", "first", "t2", "second"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatListTable(&buf, tt.tokens)
			if err != nil {
				t.Fatalf("FormatListTable() error = %v", err)
			}
			output := buf.String()
			for _, text := range tt.wantText {
				if !strings.Contains(output, text) {
					t.Errorf("output = %q, want it to contain %q", output, text)
				}
			}
		})
	}
}

func TestServiceTokenFormatter_FormatDeleteSuccessMessage(t *testing.T) {
	f := NewServiceTokenFormatter()

	var buf bytes.Buffer
	err := f.FormatDeleteSuccessMessage(&buf, "tok-to-delete")
	if err != nil {
		t.Fatalf("FormatDeleteSuccessMessage() error = %v", err)
	}
	output := buf.String()
	if !strings.Contains(output, "tok-to-delete") {
		t.Errorf("output = %q, want it to contain the token ID", output)
	}
}

// ---------------------------------------------------------------------------
// OidcFormatter tests
// ---------------------------------------------------------------------------

func TestOidcFormatter_FormatCreateSuccess(t *testing.T) {
	f := NewOidcFormatter()

	tests := []struct {
		name     string
		provider domain.OidcProvider
		wantText []string
	}{
		{
			name: "full provider with allowed subjects",
			provider: domain.OidcProvider{
				ID:              "oidc-001",
				ProviderType:    "github_actions",
				IssuerURL:       "https://token.actions.githubusercontent.com",
				Audience:        "https://envsync.cloud",
				Enabled:         true,
				AllowedSubjects: []string{"repo:org/repo:ref:refs/heads/main"},
			},
			wantText: []string{"oidc-001", "github_actions", "token.actions.githubusercontent.com", "true", "repo:org/repo"},
		},
		{
			name: "provider without allowed subjects",
			provider: domain.OidcProvider{
				ID:           "oidc-002",
				ProviderType: "kubernetes",
				IssuerURL:    "https://kubernetes.default.svc",
				Audience:     "envsync",
				Enabled:      false,
			},
			wantText: []string{"oidc-002", "kubernetes", "false"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatCreateSuccess(&buf, tt.provider)
			if err != nil {
				t.Fatalf("FormatCreateSuccess() error = %v", err)
			}
			output := buf.String()
			for _, text := range tt.wantText {
				if !strings.Contains(output, text) {
					t.Errorf("output = %q, want it to contain %q", output, text)
				}
			}
		})
	}
}

func TestOidcFormatter_FormatList(t *testing.T) {
	f := NewOidcFormatter()

	tests := []struct {
		name      string
		providers []domain.OidcProvider
		wantText  []string
	}{
		{
			name:      "empty list",
			providers: []domain.OidcProvider{},
			wantText:  []string{"No OIDC providers found"},
		},
		{
			name: "single provider",
			providers: []domain.OidcProvider{
				{
					ID: "oidc-1", ProviderType: "github_actions",
					IssuerURL: "https://token.actions.githubusercontent.com",
					Audience:  "envsync", Enabled: true,
				},
			},
			wantText: []string{"oidc-1", "github_actions", "ID", "TYPE", "ISSUER URL"},
		},
		{
			name: "multiple providers",
			providers: []domain.OidcProvider{
				{ID: "a", ProviderType: "github_actions", IssuerURL: "https://a.com", Audience: "a1", Enabled: true},
				{ID: "b", ProviderType: "kubernetes", IssuerURL: "https://b.com", Audience: "b1", Enabled: false},
			},
			wantText: []string{"a", "b", "github_actions", "kubernetes"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatList(&buf, tt.providers)
			if err != nil {
				t.Fatalf("FormatList() error = %v", err)
			}
			output := buf.String()
			for _, text := range tt.wantText {
				if !strings.Contains(output, text) {
					t.Errorf("output = %q, want it to contain %q", output, text)
				}
			}
		})
	}
}

func TestOidcFormatter_FormatDetail(t *testing.T) {
	f := NewOidcFormatter()

	tests := []struct {
		name     string
		provider domain.OidcProvider
		wantText []string
	}{
		{
			name: "full detail with subjects and machine user",
			provider: domain.OidcProvider{
				ID: "oidc-d1", OrgID: "org-1", ProviderType: "github_actions",
				IssuerURL: "https://token.actions.githubusercontent.com",
				Audience: "envsync", Enabled: true,
				AllowedSubjects: []string{"repo:a/b", "repo:c/d"},
				MachineUserID:   "mu-001",
				CreatedAt:       "2025-01-01", UpdatedAt: "2025-06-01",
			},
			wantText: []string{"oidc-d1", "org-1", "mu-001", "repo:a/b, repo:c/d", "2025-01-01"},
		},
		{
			name: "detail without subjects shows (all)",
			provider: domain.OidcProvider{
				ID: "oidc-d2", OrgID: "org-2", ProviderType: "gitlab_ci",
				IssuerURL: "https://gitlab.com", Audience: "envsync", Enabled: false,
				CreatedAt: "2025-02-01", UpdatedAt: "2025-02-01",
			},
			wantText: []string{"oidc-d2", "(all)"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatDetail(&buf, tt.provider)
			if err != nil {
				t.Fatalf("FormatDetail() error = %v", err)
			}
			output := buf.String()
			for _, text := range tt.wantText {
				if !strings.Contains(output, text) {
					t.Errorf("output = %q, want it to contain %q", output, text)
				}
			}
		})
	}
}

func TestOidcFormatter_FormatDeleteSuccess(t *testing.T) {
	f := NewOidcFormatter()

	var buf bytes.Buffer
	err := f.FormatDeleteSuccess(&buf, "oidc-to-delete")
	if err != nil {
		t.Fatalf("FormatDeleteSuccess() error = %v", err)
	}
	output := buf.String()
	if !strings.Contains(output, "oidc-to-delete") {
		t.Errorf("output = %q, want it to contain the provider ID", output)
	}
}

// ---------------------------------------------------------------------------
// SamlFormatter tests
// ---------------------------------------------------------------------------

func TestSamlFormatter_FormatCreateSuccess(t *testing.T) {
	f := NewSamlFormatter()

	tests := []struct {
		name     string
		provider domain.SamlProvider
		wantText []string
	}{
		{
			name: "full provider",
			provider: domain.SamlProvider{
				ID: "saml-001", ProviderType: "okta", Name: "My Okta",
				EntityID: "https://okta.com/app/123", SsoURL: "https://okta.com/sso",
				Enabled: true,
			},
			wantText: []string{"saml-001", "okta", "My Okta", "https://okta.com/app/123", "https://okta.com/sso", "true"},
		},
		{
			name: "disabled provider",
			provider: domain.SamlProvider{
				ID: "saml-002", ProviderType: "azure-ad", Name: "Azure AD",
				EntityID: "https://azure.com/app", SsoURL: "https://azure.com/sso",
				Enabled: false,
			},
			wantText: []string{"saml-002", "azure-ad", "false"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatCreateSuccess(&buf, tt.provider)
			if err != nil {
				t.Fatalf("FormatCreateSuccess() error = %v", err)
			}
			output := buf.String()
			for _, text := range tt.wantText {
				if !strings.Contains(output, text) {
					t.Errorf("output = %q, want it to contain %q", output, text)
				}
			}
		})
	}
}

func TestSamlFormatter_FormatList(t *testing.T) {
	f := NewSamlFormatter()

	tests := []struct {
		name      string
		providers []domain.SamlProvider
		wantText  []string
	}{
		{
			name:      "empty list",
			providers: []domain.SamlProvider{},
			wantText:  []string{"No SAML providers found"},
		},
		{
			name: "single provider",
			providers: []domain.SamlProvider{
				{ID: "s1", ProviderType: "okta", Name: "Okta", EntityID: "https://okta.com", Enabled: true},
			},
			wantText: []string{"s1", "okta", "ID", "TYPE", "NAME"},
		},
		{
			name: "multiple providers",
			providers: []domain.SamlProvider{
				{ID: "s1", ProviderType: "okta", Name: "Okta", EntityID: "https://okta.com", Enabled: true},
				{ID: "s2", ProviderType: "duo", Name: "Duo", EntityID: "https://duo.com", Enabled: false},
			},
			wantText: []string{"s1", "s2", "okta", "duo"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatList(&buf, tt.providers)
			if err != nil {
				t.Fatalf("FormatList() error = %v", err)
			}
			output := buf.String()
			for _, text := range tt.wantText {
				if !strings.Contains(output, text) {
					t.Errorf("output = %q, want it to contain %q", output, text)
				}
			}
		})
	}
}

func TestSamlFormatter_FormatDetail(t *testing.T) {
	f := NewSamlFormatter()

	tests := []struct {
		name     string
		provider domain.SamlProvider
		wantText []string
	}{
		{
			name: "full detail",
			provider: domain.SamlProvider{
				ID: "saml-d1", OrgID: "org-1", ProviderType: "okta",
				Name: "Okta SSO", EntityID: "https://okta.com/app",
				SsoURL: "https://okta.com/sso", Certificate: "MIIDxTCCAq2gAw...",
				Enabled: true, CreatedAt: "2025-01-01", UpdatedAt: "2025-06-01",
			},
			wantText: []string{"saml-d1", "org-1", "okta", "Okta SSO", "MIIDxTCCAq2gAw", "2025-01-01"},
		},
		{
			name: "long certificate gets truncated",
			provider: domain.SamlProvider{
				ID: "saml-d2", OrgID: "org-2", ProviderType: "onelogin",
				Name: "OneLogin", EntityID: "https://onelogin.com",
				SsoURL: "https://onelogin.com/sso",
				Certificate: strings.Repeat("A", 100),
				Enabled: false, CreatedAt: "2025-02-01", UpdatedAt: "2025-02-01",
			},
			wantText: []string{"saml-d2", "..."},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatDetail(&buf, tt.provider)
			if err != nil {
				t.Fatalf("FormatDetail() error = %v", err)
			}
			output := buf.String()
			for _, text := range tt.wantText {
				if !strings.Contains(output, text) {
					t.Errorf("output = %q, want it to contain %q", output, text)
				}
			}
		})
	}
}

func TestSamlFormatter_FormatDeleteSuccess(t *testing.T) {
	f := NewSamlFormatter()

	var buf bytes.Buffer
	err := f.FormatDeleteSuccess(&buf, "saml-del-1")
	if err != nil {
		t.Fatalf("FormatDeleteSuccess() error = %v", err)
	}
	output := buf.String()
	if !strings.Contains(output, "saml-del-1") {
		t.Errorf("output = %q, want it to contain the provider ID", output)
	}
}

func TestSamlFormatter_FormatMetadataSuccess(t *testing.T) {
	f := NewSamlFormatter()

	var buf bytes.Buffer
	err := f.FormatMetadataSuccess(&buf, "saml-meta-1")
	if err != nil {
		t.Fatalf("FormatMetadataSuccess() error = %v", err)
	}
	output := buf.String()
	if !strings.Contains(output, "saml-meta-1") {
		t.Errorf("output = %q, want it to contain the provider ID", output)
	}
}

func TestSamlFormatter_FormatSsoResult(t *testing.T) {
	f := NewSamlFormatter()

	tests := []struct {
		name     string
		result   domain.SamlSsoResult
		wantText []string
	}{
		{
			name:     "standard SSO result",
			result:   domain.SamlSsoResult{RedirectURL: "https://idp.example.com/sso?SAMLRequest=abc", RequestID: "req-123"},
			wantText: []string{"https://idp.example.com/sso", "req-123", "Redirect URL"},
		},
		{
			name:     "result with empty fields",
			result:   domain.SamlSsoResult{},
			wantText: []string{"Redirect URL", "Request ID"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatSsoResult(&buf, tt.result)
			if err != nil {
				t.Fatalf("FormatSsoResult() error = %v", err)
			}
			output := buf.String()
			for _, text := range tt.wantText {
				if !strings.Contains(output, text) {
					t.Errorf("output = %q, want it to contain %q", output, text)
				}
			}
		})
	}
}

// ---------------------------------------------------------------------------
// RotationFormatter tests
// ---------------------------------------------------------------------------

func TestRotationFormatter_FormatPolicyList(t *testing.T) {
	f := NewRotationFormatter()

	tests := []struct {
		name     string
		policies managementsdk.RotationPoliciesResponse
		wantText []string
	}{
		{
			name:     "empty list",
			policies: managementsdk.RotationPoliciesResponse{},
			wantText: []string{"No rotation policies found"},
		},
		{
			name: "single enabled policy",
			policies: managementsdk.RotationPoliciesResponse{
				&managementsdk.RotationPolicyResponse{
					Id: "rp-1", EngineType: managementsdk.RotationPolicyResponseEngineTypePostgres,
					VariableKey: "DB_PASSWORD", ScheduleCron: "0 */6 * * *", Enabled: true,
				},
			},
			wantText: []string{"rp-1", "postgres", "DB_PASSWORD", "0 */6 * * *", "enabled"},
		},
		{
			name: "multiple policies mixed enabled",
			policies: managementsdk.RotationPoliciesResponse{
				&managementsdk.RotationPolicyResponse{
					Id: "rp-1", EngineType: managementsdk.RotationPolicyResponseEngineTypeAwsIam,
					VariableKey: "AWS_KEY", ScheduleCron: "0 0 * * *", Enabled: true,
				},
				&managementsdk.RotationPolicyResponse{
					Id: "rp-2", EngineType: managementsdk.RotationPolicyResponseEngineTypeMysql,
					VariableKey: "MYSQL_PASS", ScheduleCron: "0 */12 * * *", Enabled: false,
				},
			},
			wantText: []string{"rp-1", "rp-2", "aws-iam", "mysql", "disabled"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatPolicyList(&buf, tt.policies)
			if err != nil {
				t.Fatalf("FormatPolicyList() error = %v", err)
			}
			output := buf.String()
			for _, text := range tt.wantText {
				if !strings.Contains(output, text) {
					t.Errorf("output = %q, want it to contain %q", output, text)
				}
			}
		})
	}
}

func TestRotationFormatter_FormatPolicyDetail(t *testing.T) {
	f := NewRotationFormatter()

	policy := &managementsdk.RotationPolicyResponse{
		Id: "rp-detail", OrgId: "org-1", AppId: "app-1", EnvTypeId: "env-1",
		VariableKey: "DB_SECRET", EngineType: managementsdk.RotationPolicyResponseEngineTypePostgres,
		ScheduleCron: "0 */6 * * *", DualWindowMinutes: 30, Enabled: true,
		CreatedAt: "2025-01-01", UpdatedAt: "2025-06-01",
	}

	var buf bytes.Buffer
	err := f.FormatPolicyDetail(&buf, policy)
	if err != nil {
		t.Fatalf("FormatPolicyDetail() error = %v", err)
	}
	output := buf.String()
	for _, text := range []string{"rp-detail", "postgres", "DB_SECRET", "0 */6 * * *", "true", "30"} {
		if !strings.Contains(output, text) {
			t.Errorf("output = %q, want it to contain %q", output, text)
		}
	}
}

func TestRotationFormatter_FormatCreateSuccess(t *testing.T) {
	f := NewRotationFormatter()

	policy := &managementsdk.RotationPolicyResponse{
		Id: "rp-new", EngineType: managementsdk.RotationPolicyResponseEngineTypeAzureSp,
		VariableKey: "AZURE_SECRET", ScheduleCron: "0 0 * * 1",
	}

	var buf bytes.Buffer
	err := f.FormatCreateSuccess(&buf, policy)
	if err != nil {
		t.Fatalf("FormatCreateSuccess() error = %v", err)
	}
	output := buf.String()
	for _, text := range []string{"rp-new", "azure-sp", "AZURE_SECRET", "created successfully"} {
		if !strings.Contains(output, text) {
			t.Errorf("output = %q, want it to contain %q", output, text)
		}
	}
}

func TestRotationFormatter_FormatUpdateSuccess(t *testing.T) {
	f := NewRotationFormatter()

	policy := &managementsdk.RotationPolicyResponse{
		Id: "rp-updated", EngineType: managementsdk.RotationPolicyResponseEngineTypePostgres,
		ScheduleCron: "0 */12 * * *", Enabled: false,
	}

	var buf bytes.Buffer
	err := f.FormatUpdateSuccess(&buf, policy)
	if err != nil {
		t.Fatalf("FormatUpdateSuccess() error = %v", err)
	}
	output := buf.String()
	for _, text := range []string{"rp-updated", "postgres", "updated successfully"} {
		if !strings.Contains(output, text) {
			t.Errorf("output = %q, want it to contain %q", output, text)
		}
	}
}

func TestRotationFormatter_FormatTriggerSuccess(t *testing.T) {
	f := NewRotationFormatter()

	result := &managementsdk.TriggerRotationResponse{
		Message:                "Rotation initiated",
		RotationStateId:        "state-001",
		NewCredentialStored:    true,
		OldCredentialExpiresAt: "2025-07-01T00:00:00Z",
	}

	var buf bytes.Buffer
	err := f.FormatTriggerSuccess(&buf, result)
	if err != nil {
		t.Fatalf("FormatTriggerSuccess() error = %v", err)
	}
	output := buf.String()
	for _, text := range []string{"Rotation initiated", "state-001", "true", "2025-07-01"} {
		if !strings.Contains(output, text) {
			t.Errorf("output = %q, want it to contain %q", output, text)
		}
	}
}

func TestRotationFormatter_FormatStatesList(t *testing.T) {
	f := NewRotationFormatter()

	tests := []struct {
		name     string
		states   managementsdk.RotationStatesResponse
		wantText []string
	}{
		{
			name:     "empty states",
			states:   managementsdk.RotationStatesResponse{},
			wantText: []string{"No rotation states found"},
		},
		{
			name: "single state",
			states: managementsdk.RotationStatesResponse{
				&managementsdk.RotationStateResponse{
					Id: "st-1", RotatedAt: "2025-06-01T00:00:00Z",
					OldCredentialExpiresAt: "2025-07-01T00:00:00Z",
					OldCredentialRevoked:   true,
				},
			},
			wantText: []string{"st-1", "2025-06-01", "yes"},
		},
		{
			name: "state with revoked=no",
			states: managementsdk.RotationStatesResponse{
				&managementsdk.RotationStateResponse{
					Id: "st-2", RotatedAt: "2025-06-15T00:00:00Z",
					OldCredentialExpiresAt: "2025-07-15T00:00:00Z",
					OldCredentialRevoked:   false,
				},
			},
			wantText: []string{"st-2", "no"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatStatesList(&buf, tt.states)
			if err != nil {
				t.Fatalf("FormatStatesList() error = %v", err)
			}
			output := buf.String()
			for _, text := range tt.wantText {
				if !strings.Contains(output, text) {
					t.Errorf("output = %q, want it to contain %q", output, text)
				}
			}
		})
	}
}

func TestRotationFormatter_FormatRevokeSuccess(t *testing.T) {
	f := NewRotationFormatter()

	result := &managementsdk.RevokeOldCredentialResponse{
		Message:   "Credentials revoked",
		RevokedAt: "2025-06-01T12:00:00Z",
	}

	var buf bytes.Buffer
	err := f.FormatRevokeSuccess(&buf, result)
	if err != nil {
		t.Fatalf("FormatRevokeSuccess() error = %v", err)
	}
	output := buf.String()
	for _, text := range []string{"Credentials revoked", "2025-06-01T12:00:00Z"} {
		if !strings.Contains(output, text) {
			t.Errorf("output = %q, want it to contain %q", output, text)
		}
	}
}

// ---------------------------------------------------------------------------
// DynamicSecretFormatter tests
// ---------------------------------------------------------------------------

func TestDynamicSecretFormatter_FormatEngineList(t *testing.T) {
	f := NewDynamicSecretFormatter()

	tests := []struct {
		name     string
		engines  managementsdk.DynamicSecretEnginesResponse
		wantText []string
	}{
		{
			name:     "empty list",
			engines:  managementsdk.DynamicSecretEnginesResponse{},
			wantText: []string{"No dynamic secret engines found"},
		},
		{
			name: "single engine",
			engines: managementsdk.DynamicSecretEnginesResponse{
				&managementsdk.DynamicSecretEngineResponse{
					Id: "eng-1", Name: "Postgres Engine",
					EngineType: managementsdk.DynamicSecretEngineResponseEngineTypePostgres, Enabled: true,
				},
			},
			wantText: []string{"eng-1", "Postgres Engine", "postgres", "enabled"},
		},
		{
			name: "multiple engines",
			engines: managementsdk.DynamicSecretEnginesResponse{
				&managementsdk.DynamicSecretEngineResponse{
					Id: "e1", Name: "PG", EngineType: managementsdk.DynamicSecretEngineResponseEngineTypePostgres, Enabled: true,
				},
				&managementsdk.DynamicSecretEngineResponse{
					Id: "e2", Name: "AWS", EngineType: managementsdk.DynamicSecretEngineResponseEngineTypeAwsIam, Enabled: false,
				},
			},
			wantText: []string{"e1", "e2", "disabled"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatEngineList(&buf, tt.engines)
			if err != nil {
				t.Fatalf("FormatEngineList() error = %v", err)
			}
			output := buf.String()
			for _, text := range tt.wantText {
				if !strings.Contains(output, text) {
					t.Errorf("output = %q, want it to contain %q", output, text)
				}
			}
		})
	}
}

func TestDynamicSecretFormatter_FormatEngineDetail(t *testing.T) {
	f := NewDynamicSecretFormatter()

	engine := &managementsdk.DynamicSecretEngineResponse{
		Id: "eng-detail", Name: "My Engine", OrgId: "org-1",
		EngineType: managementsdk.DynamicSecretEngineResponseEngineTypeMysql,
		Enabled:    true, CreatedAt: "2025-01-01", UpdatedAt: "2025-06-01",
	}

	var buf bytes.Buffer
	err := f.FormatEngineDetail(&buf, engine)
	if err != nil {
		t.Fatalf("FormatEngineDetail() error = %v", err)
	}
	output := buf.String()
	for _, text := range []string{"eng-detail", "My Engine", "mysql", "Yes", "2025-01-01"} {
		if !strings.Contains(output, text) {
			t.Errorf("output = %q, want it to contain %q", output, text)
		}
	}
}

func TestDynamicSecretFormatter_FormatEngineDetail_Disabled(t *testing.T) {
	f := NewDynamicSecretFormatter()

	engine := &managementsdk.DynamicSecretEngineResponse{
		Id: "eng-off", Name: "Off Engine",
		EngineType: managementsdk.DynamicSecretEngineResponseEngineTypeAwsIam,
		Enabled:    false, CreatedAt: "2025-01-01", UpdatedAt: "2025-01-01",
	}

	var buf bytes.Buffer
	err := f.FormatEngineDetail(&buf, engine)
	if err != nil {
		t.Fatalf("FormatEngineDetail() error = %v", err)
	}
	output := buf.String()
	if !strings.Contains(output, "No") {
		t.Errorf("disabled engine detail should show 'No' for enabled, got %q", output)
	}
}

func TestDynamicSecretFormatter_FormatCreateEngineSuccess(t *testing.T) {
	f := NewDynamicSecretFormatter()

	engine := &managementsdk.DynamicSecretEngineResponse{
		Id: "eng-new", Name: "New Engine",
		EngineType: managementsdk.DynamicSecretEngineResponseEngineTypeAzureSp,
	}

	var buf bytes.Buffer
	err := f.FormatCreateEngineSuccess(&buf, engine)
	if err != nil {
		t.Fatalf("FormatCreateEngineSuccess() error = %v", err)
	}
	output := buf.String()
	for _, text := range []string{"eng-new", "New Engine", "azure-sp", "created successfully"} {
		if !strings.Contains(output, text) {
			t.Errorf("output = %q, want it to contain %q", output, text)
		}
	}
}

func TestDynamicSecretFormatter_FormatUpdateEngineSuccess(t *testing.T) {
	f := NewDynamicSecretFormatter()

	engine := &managementsdk.DynamicSecretEngineResponse{
		Id: "eng-upd", Name: "Updated Engine",
		EngineType: managementsdk.DynamicSecretEngineResponseEngineTypePostgres,
		Enabled:    true,
	}

	var buf bytes.Buffer
	err := f.FormatUpdateEngineSuccess(&buf, engine)
	if err != nil {
		t.Fatalf("FormatUpdateEngineSuccess() error = %v", err)
	}
	output := buf.String()
	for _, text := range []string{"eng-upd", "Updated Engine", "postgres", "updated successfully"} {
		if !strings.Contains(output, text) {
			t.Errorf("output = %q, want it to contain %q", output, text)
		}
	}
}

func TestDynamicSecretFormatter_FormatLeaseList(t *testing.T) {
	f := NewDynamicSecretFormatter()

	tests := []struct {
		name     string
		leases   managementsdk.DynamicSecretLeasesResponse
		wantText []string
	}{
		{
			name:     "empty list",
			leases:   managementsdk.DynamicSecretLeasesResponse{},
			wantText: []string{"No dynamic secret leases found"},
		},
		{
			name: "single active lease",
			leases: managementsdk.DynamicSecretLeasesResponse{
				&managementsdk.DynamicSecretLeaseResponse{
					Id: "ls-1", EngineId: "eng-1", VariableKey: "DB_CREDS",
					ExpiresAt: "2025-07-01T00:00:00Z",
				},
			},
			wantText: []string{"ls-1", "eng-1", "DB_CREDS", "active"},
		},
		{
			name: "revoked lease",
			leases: managementsdk.DynamicSecretLeasesResponse{
				&managementsdk.DynamicSecretLeaseResponse{
					Id: "ls-2", EngineId: "eng-1", VariableKey: "OLD_CREDS",
					ExpiresAt: "2025-06-01T00:00:00Z",
					RevokedAt: strPtr("2025-05-15T00:00:00Z"),
				},
			},
			wantText: []string{"ls-2", "revoked"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatLeaseList(&buf, tt.leases)
			if err != nil {
				t.Fatalf("FormatLeaseList() error = %v", err)
			}
			output := buf.String()
			for _, text := range tt.wantText {
				if !strings.Contains(output, text) {
					t.Errorf("output = %q, want it to contain %q", output, text)
				}
			}
		})
	}
}

func TestDynamicSecretFormatter_FormatLeaseDetail(t *testing.T) {
	f := NewDynamicSecretFormatter()

	tests := []struct {
		name     string
		lease    *managementsdk.DynamicSecretLeaseResponse
		wantText []string
	}{
		{
			name: "active lease",
			lease: &managementsdk.DynamicSecretLeaseResponse{
				Id: "ls-d1", EngineId: "eng-1", VariableKey: "CREDS",
				ExpiresAt: "2025-12-31T00:00:00Z", CreatedAt: "2025-01-01", UpdatedAt: "2025-06-01",
			},
			wantText: []string{"ls-d1", "eng-1", "CREDS", "active", "2025-12-31"},
		},
		{
			name: "revoked lease",
			lease: &managementsdk.DynamicSecretLeaseResponse{
				Id: "ls-d2", EngineId: "eng-2", VariableKey: "OLD",
				ExpiresAt: "2025-06-01", RevokedAt: strPtr("2025-05-01"),
				CreatedAt: "2025-01-01", UpdatedAt: "2025-05-01",
			},
			wantText: []string{"ls-d2", "revoked"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatLeaseDetail(&buf, tt.lease)
			if err != nil {
				t.Fatalf("FormatLeaseDetail() error = %v", err)
			}
			output := buf.String()
			for _, text := range tt.wantText {
				if !strings.Contains(output, text) {
					t.Errorf("output = %q, want it to contain %q", output, text)
				}
			}
		})
	}
}

func TestDynamicSecretFormatter_FormatCreateLeaseSuccess(t *testing.T) {
	f := NewDynamicSecretFormatter()

	lease := &managementsdk.DynamicSecretLeaseResponse{
		Id: "ls-new", EngineId: "eng-1", VariableKey: "NEW_CREDS",
		ExpiresAt: "2025-12-31T00:00:00Z",
	}

	var buf bytes.Buffer
	err := f.FormatCreateLeaseSuccess(&buf, lease)
	if err != nil {
		t.Fatalf("FormatCreateLeaseSuccess() error = %v", err)
	}
	output := buf.String()
	for _, text := range []string{"ls-new", "eng-1", "NEW_CREDS", "created successfully"} {
		if !strings.Contains(output, text) {
			t.Errorf("output = %q, want it to contain %q", output, text)
		}
	}
}

func TestDynamicSecretFormatter_FormatRevokeLeaseSuccess(t *testing.T) {
	f := NewDynamicSecretFormatter()

	result := &managementsdk.RevokeLeaseResponse{
		Message: "Lease revoked",
		Id:      "ls-revoked",
	}

	var buf bytes.Buffer
	err := f.FormatRevokeLeaseSuccess(&buf, result)
	if err != nil {
		t.Fatalf("FormatRevokeLeaseSuccess() error = %v", err)
	}
	output := buf.String()
	for _, text := range []string{"Lease revoked", "ls-revoked"} {
		if !strings.Contains(output, text) {
			t.Errorf("output = %q, want it to contain %q", output, text)
		}
	}
}

func TestDynamicSecretFormatter_FormatCleanupSuccess(t *testing.T) {
	f := NewDynamicSecretFormatter()

	result := &managementsdk.CleanupResponse{Cleaned: 5}

	var buf bytes.Buffer
	err := f.FormatCleanupSuccess(&buf, result)
	if err != nil {
		t.Fatalf("FormatCleanupSuccess() error = %v", err)
	}
	output := buf.String()
	for _, text := range []string{"5", "cleanup completed"} {
		if !strings.Contains(output, text) {
			t.Errorf("output = %q, want it to contain %q", output, text)
		}
	}
}

// ---------------------------------------------------------------------------
// LogForwardingFormatter tests
// ---------------------------------------------------------------------------

func TestLogForwardingFormatter_FormatCreateSuccess(t *testing.T) {
	f := NewLogForwardingFormatter()

	config := &managementsdk.LogForwardingResponse{
		Id: "lf-1", Name: "Datadog Logs", OrgId: "org-1",
		ProviderType: managementsdk.LogForwardingResponseProviderTypeDatadog,
		Enabled:      true, CreatedAt: "2025-01-01", UpdatedAt: "2025-06-01",
	}

	var buf bytes.Buffer
	err := f.FormatCreateSuccess(&buf, config)
	if err != nil {
		t.Fatalf("FormatCreateSuccess() error = %v", err)
	}
	output := buf.String()
	for _, text := range []string{"Datadog Logs", "lf-1", "datadog", "true", "created successfully"} {
		if !strings.Contains(output, text) {
			t.Errorf("output = %q, want it to contain %q", output, text)
		}
	}
}

func TestLogForwardingFormatter_FormatListTable(t *testing.T) {
	f := NewLogForwardingFormatter()

	tests := []struct {
		name     string
		configs  managementsdk.LogForwardingsResponse
		wantText []string
	}{
		{
			name:     "empty list",
			configs:  managementsdk.LogForwardingsResponse{},
			wantText: []string{"ID", "NAME", "PROVIDER", "ENABLED"},
		},
		{
			name: "single config",
			configs: managementsdk.LogForwardingsResponse{
				&managementsdk.LogForwardingResponse{
					Id: "lf-1", Name: "DD", ProviderType: managementsdk.LogForwardingResponseProviderTypeDatadog,
					Enabled: true, CreatedAt: "2025-01-01",
				},
			},
			wantText: []string{"lf-1", "DD", "datadog", "true"},
		},
		{
			name: "multiple configs",
			configs: managementsdk.LogForwardingsResponse{
				&managementsdk.LogForwardingResponse{
					Id: "lf-1", Name: "DD", ProviderType: managementsdk.LogForwardingResponseProviderTypeDatadog,
					Enabled: true, CreatedAt: "2025-01-01",
				},
				&managementsdk.LogForwardingResponse{
					Id: "lf-2", Name: "Splunk", ProviderType: managementsdk.LogForwardingResponseProviderTypeSplunk,
					Enabled: false, CreatedAt: "2025-02-01",
				},
			},
			wantText: []string{"lf-1", "lf-2", "datadog", "splunk"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatListTable(&buf, tt.configs)
			if err != nil {
				t.Fatalf("FormatListTable() error = %v", err)
			}
			output := buf.String()
			for _, text := range tt.wantText {
				if !strings.Contains(output, text) {
					t.Errorf("output = %q, want it to contain %q", output, text)
				}
			}
		})
	}
}

func TestLogForwardingFormatter_FormatGetDetail(t *testing.T) {
	f := NewLogForwardingFormatter()

	tests := []struct {
		name     string
		config   *managementsdk.LogForwardingResponse
		wantText []string
	}{
		{
			name: "config without api_key masking",
			config: &managementsdk.LogForwardingResponse{
				Id: "lf-d1", OrgId: "org-1", Name: "Sumo Logic",
				ProviderType: managementsdk.LogForwardingResponseProviderTypeSumoLogic,
				Enabled: true, CreatedAt: "2025-01-01", UpdatedAt: "2025-06-01",
				Config: map[string]interface{}{"endpoint": "https://sumologic.com/collect"},
			},
			wantText: []string{"lf-d1", "org-1", "Sumo Logic", "sumo-logic", "endpoint"},
		},
		{
			name: "config with api_key masked",
			config: &managementsdk.LogForwardingResponse{
				Id: "lf-d2", OrgId: "org-1", Name: "Datadog",
				ProviderType: managementsdk.LogForwardingResponseProviderTypeDatadog,
				Enabled: true, CreatedAt: "2025-01-01", UpdatedAt: "2025-06-01",
				Config: map[string]interface{}{"api_key": "secret-key-123", "site": "datadoghq.com"},
			},
			wantText: []string{"lf-d2", "Datadog", "api_key", "****", "site"},
		},
		{
			name: "config with nil config map",
			config: &managementsdk.LogForwardingResponse{
				Id: "lf-d3", OrgId: "org-1", Name: "No Config",
				ProviderType: managementsdk.LogForwardingResponseProviderTypeSplunk,
				Enabled: false, CreatedAt: "2025-01-01", UpdatedAt: "2025-01-01",
			},
			wantText: []string{"lf-d3", "No Config"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := f.FormatGetDetail(&buf, tt.config)
			if err != nil {
				t.Fatalf("FormatGetDetail() error = %v", err)
			}
			output := buf.String()
			for _, text := range tt.wantText {
				if !strings.Contains(output, text) {
					t.Errorf("output = %q, want it to contain %q", output, text)
				}
			}
		})
	}
}

func TestLogForwardingFormatter_FormatGetDetail_ApiKeyMasking(t *testing.T) {
	f := NewLogForwardingFormatter()

	config := &managementsdk.LogForwardingResponse{
		Id: "lf-mask", OrgId: "org-1", Name: "DD",
		ProviderType: managementsdk.LogForwardingResponseProviderTypeDatadog,
		Enabled: true, CreatedAt: "2025-01-01", UpdatedAt: "2025-06-01",
		Config: map[string]interface{}{"api_key": "super-secret-key-do-not-leak"},
	}

	var buf bytes.Buffer
	err := f.FormatGetDetail(&buf, config)
	if err != nil {
		t.Fatalf("FormatGetDetail() error = %v", err)
	}
	output := buf.String()
	// The actual secret must NOT appear in output
	if strings.Contains(output, "super-secret-key-do-not-leak") {
		t.Error("FormatGetDetail() should mask api_key values, but the secret was found in output")
	}
	// The masked version should appear
	if !strings.Contains(output, "****") {
		t.Error("FormatGetDetail() should show **** for api_key")
	}
}

func TestLogForwardingFormatter_FormatDeleteSuccess(t *testing.T) {
	f := NewLogForwardingFormatter()

	var buf bytes.Buffer
	err := f.FormatDeleteSuccess(&buf, "lf-to-delete")
	if err != nil {
		t.Fatalf("FormatDeleteSuccess() error = %v", err)
	}
	output := buf.String()
	if !strings.Contains(output, "lf-to-delete") {
		t.Errorf("output = %q, want it to contain the config ID", output)
	}
	if !strings.Contains(output, "deleted successfully") {
		t.Errorf("output = %q, want it to contain 'deleted successfully'", output)
	}
}

// ---------------------------------------------------------------------------
// Constructor tests
// ---------------------------------------------------------------------------

func TestNewServiceTokenFormatter(t *testing.T) {
	f := NewServiceTokenFormatter()
	if f == nil {
		t.Fatal("NewServiceTokenFormatter() returned nil")
	}
	if f.BaseFormatter == nil {
		t.Fatal("ServiceTokenFormatter.BaseFormatter is nil")
	}
}

func TestNewOidcFormatter(t *testing.T) {
	f := NewOidcFormatter()
	if f == nil {
		t.Fatal("NewOidcFormatter() returned nil")
	}
	if f.BaseFormatter == nil {
		t.Fatal("OidcFormatter.BaseFormatter is nil")
	}
}

func TestNewSamlFormatter(t *testing.T) {
	f := NewSamlFormatter()
	if f == nil {
		t.Fatal("NewSamlFormatter() returned nil")
	}
	if f.BaseFormatter == nil {
		t.Fatal("SamlFormatter.BaseFormatter is nil")
	}
}

func TestNewRotationFormatter(t *testing.T) {
	f := NewRotationFormatter()
	if f == nil {
		t.Fatal("NewRotationFormatter() returned nil")
	}
	if f.BaseFormatter == nil {
		t.Fatal("RotationFormatter.BaseFormatter is nil")
	}
}

func TestNewDynamicSecretFormatter(t *testing.T) {
	f := NewDynamicSecretFormatter()
	if f == nil {
		t.Fatal("NewDynamicSecretFormatter() returned nil")
	}
	if f.BaseFormatter == nil {
		t.Fatal("DynamicSecretFormatter.BaseFormatter is nil")
	}
}

func TestNewLogForwardingFormatter(t *testing.T) {
	f := NewLogForwardingFormatter()
	if f == nil {
		t.Fatal("NewLogForwardingFormatter() returned nil")
	}
	if f.BaseFormatter == nil {
		t.Fatal("LogForwardingFormatter.BaseFormatter is nil")
	}
}

// ---------------------------------------------------------------------------
// Writer error propagation tests
// ---------------------------------------------------------------------------

type errWriter struct{}

func (e errWriter) Write(p []byte) (int, error) {
	return 0, errors.New("write failed")
}

func TestFormatters_PropagateWriterErrors(t *testing.T) {
	t.Run("BaseFormatter_FormatJSON", func(t *testing.T) {
		f := NewBaseFormatter()
		err := f.FormatJSON(errWriter{}, map[string]string{"a": "b"})
		if err == nil {
			t.Error("expected error from writer, got nil")
		}
	})

	t.Run("BaseFormatter_FormatError", func(t *testing.T) {
		f := NewBaseFormatter()
		err := f.FormatError(errWriter{}, "test")
		if err == nil {
			t.Error("expected error from writer, got nil")
		}
	})

	t.Run("BaseFormatter_FormatSuccess", func(t *testing.T) {
		f := NewBaseFormatter()
		err := f.FormatSuccess(errWriter{}, "test")
		if err == nil {
			t.Error("expected error from writer, got nil")
		}
	})

	t.Run("ServiceTokenFormatter_FormatListTable", func(t *testing.T) {
		f := NewServiceTokenFormatter()
		err := f.FormatListTable(errWriter{}, sdk.ServiceTokensResponse{})
		if err == nil {
			t.Error("expected error from writer, got nil")
		}
	})

	t.Run("LogForwardingFormatter_FormatListTable", func(t *testing.T) {
		f := NewLogForwardingFormatter()
		err := f.FormatListTable(errWriter{}, managementsdk.LogForwardingsResponse{})
		if err == nil {
			t.Error("expected error from writer, got nil")
		}
	})
}

// ---------------------------------------------------------------------------
// Edge case: truncate helpers
// ---------------------------------------------------------------------------

func TestTruncateOidc(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		maxLen int
		want   string
	}{
		{name: "short string", input: "hello", maxLen: 10, want: "hello"},
		{name: "exact length", input: "hello", maxLen: 5, want: "hello"},
		{name: "needs truncation", input: "hello world", maxLen: 8, want: "hello..."},
		{name: "maxLen 3", input: "abcdef", maxLen: 3, want: "..."},
		{name: "empty string", input: "", maxLen: 5, want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := truncateOidc(tt.input, tt.maxLen)
			if got != tt.want {
				t.Errorf("truncateOidc(%q, %d) = %q, want %q", tt.input, tt.maxLen, got, tt.want)
			}
		})
	}
}

func TestTruncateSaml(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		maxLen int
		want   string
	}{
		{name: "short string", input: "hello", maxLen: 10, want: "hello"},
		{name: "exact length", input: "hello", maxLen: 5, want: "hello"},
		{name: "needs truncation", input: "hello world", maxLen: 8, want: "hello..."},
		{name: "empty string", input: "", maxLen: 5, want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := truncateSaml(tt.input, tt.maxLen)
			if got != tt.want {
				t.Errorf("truncateSaml(%q, %d) = %q, want %q", tt.input, tt.maxLen, got, tt.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

func strPtr(s string) *string {
	return &s
}
