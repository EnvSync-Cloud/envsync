package gpg_key

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
)

// mockGpgKeyService is a test double implementing services.GpgKeyService.
// Each method delegates to an assignable function field so tests control
// behavior.
type mockGpgKeyService struct {
	generateFn func(ctx context.Context, req requests.GenerateGpgKeyRequest) (domain.GpgKey, error)
}

var _ services.GpgKeyService = (*mockGpgKeyService)(nil)

func (m *mockGpgKeyService) ListKeys(ctx context.Context) ([]domain.GpgKey, error) {
	return nil, nil
}

func (m *mockGpgKeyService) GetKey(ctx context.Context, id string) (domain.GpgKey, error) {
	return domain.GpgKey{}, nil
}

func (m *mockGpgKeyService) GenerateKey(ctx context.Context, req requests.GenerateGpgKeyRequest) (domain.GpgKey, error) {
	if m.generateFn != nil {
		return m.generateFn(ctx, req)
	}
	return domain.GpgKey{}, nil
}

func (m *mockGpgKeyService) DeleteKey(ctx context.Context, id string) error { return nil }

func (m *mockGpgKeyService) RevokeKey(ctx context.Context, id string, reason string) (domain.GpgKey, error) {
	return domain.GpgKey{}, nil
}

func (m *mockGpgKeyService) ExportKey(ctx context.Context, id string) (string, string, error) {
	return "", "", nil
}

func (m *mockGpgKeyService) Sign(ctx context.Context, req requests.SignDataRequest) (domain.GpgSignatureResult, error) {
	return domain.GpgSignatureResult{}, nil
}

func (m *mockGpgKeyService) Verify(ctx context.Context, req requests.VerifySignatureRequest) (domain.GpgVerifyResult, error) {
	return domain.GpgVerifyResult{}, nil
}

func (m *mockGpgKeyService) RotateKey(ctx context.Context, id string, payload map[string]any) (domain.GpgKey, error) {
	return domain.GpgKey{}, nil
}

func (m *mockGpgKeyService) ExtendExpiry(ctx context.Context, id string, expiresInDays int) (domain.GpgKey, error) {
	return domain.GpgKey{}, nil
}

func TestGenerateKey_AlgorithmOptions(t *testing.T) {
	rsaKeySize := 4096
	tests := []struct {
		name          string
		algorithm     string
		wantAlgorithm string
		wantKeySize   *int
	}{
		{
			name:          "label ECC Curve25519",
			algorithm:     "ECC Curve25519",
			wantAlgorithm: "ecc-curve25519",
		},
		{
			name:          "slug ecc-p256",
			algorithm:     "ecc-p256",
			wantAlgorithm: "ecc-p256",
		},
		{
			name:          "label ECC P-384",
			algorithm:     "ECC P-384",
			wantAlgorithm: "ecc-p384",
		},
		{
			name:          "RSA 4096 pins the key size",
			algorithm:     "RSA 4096",
			wantAlgorithm: "rsa",
			wantKeySize:   &rsaKeySize,
		},
		{
			name:          "slug rsa maps to RSA 4096",
			algorithm:     "rsa",
			wantAlgorithm: "rsa",
			wantKeySize:   &rsaKeySize,
		},
		{
			name:          "separators and case are ignored",
			algorithm:     "ecc curve25519",
			wantAlgorithm: "ecc-curve25519",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var got requests.GenerateGpgKeyRequest
			uc := &generateKeyUseCase{
				service: &mockGpgKeyService{
					generateFn: func(ctx context.Context, req requests.GenerateGpgKeyRequest) (domain.GpgKey, error) {
						got = req
						return domain.GpgKey{ID: "key-1"}, nil
					},
				},
			}

			key, err := uc.Execute(context.Background(), "release-bot", "bot@example.com", tt.algorithm, nil, nil, false)
			if err != nil {
				t.Fatalf("Execute() error = %v", err)
			}
			if key.ID != "key-1" {
				t.Fatalf("key.ID = %q, want %q", key.ID, "key-1")
			}
			if got.Algorithm != tt.wantAlgorithm {
				t.Errorf("request algorithm = %q, want %q", got.Algorithm, tt.wantAlgorithm)
			}
			switch {
			case tt.wantKeySize == nil && got.KeySize != nil:
				t.Errorf("request key size = %d, want none", *got.KeySize)
			case tt.wantKeySize != nil && got.KeySize == nil:
				t.Errorf("request key size = none, want %d", *tt.wantKeySize)
			case tt.wantKeySize != nil && *got.KeySize != *tt.wantKeySize:
				t.Errorf("request key size = %d, want %d", *got.KeySize, *tt.wantKeySize)
			}
		})
	}
}

func TestGenerateKey_RejectsUnknownAlgorithm(t *testing.T) {
	uc := &generateKeyUseCase{service: &mockGpgKeyService{}}

	_, err := uc.Execute(context.Background(), "release-bot", "bot@example.com", "dsa", nil, nil, false)
	if err == nil {
		t.Fatal("Execute() error = nil, want error")
	}
	var gpgErr *GpgKeyError
	if !errors.As(err, &gpgErr) {
		t.Fatalf("error type = %T, want *GpgKeyError", err)
	}
	if gpgErr.Code != GpgKeyErrorCodeValidation {
		t.Fatalf("error code = %q, want %q", gpgErr.Code, GpgKeyErrorCodeValidation)
	}
	if !strings.Contains(err.Error(), "ECC Curve25519") {
		t.Fatalf("error %q should list the accepted algorithms", err)
	}
}

func TestGenerateKey_RequiresNameAndEmail(t *testing.T) {
	uc := &generateKeyUseCase{service: &mockGpgKeyService{}}

	if _, err := uc.Execute(context.Background(), "", "bot@example.com", "rsa", nil, nil, false); err == nil {
		t.Error("Execute() without name = nil error, want error")
	}
	if _, err := uc.Execute(context.Background(), "release-bot", "", "rsa", nil, nil, false); err == nil {
		t.Error("Execute() without email = nil error, want error")
	}
}
