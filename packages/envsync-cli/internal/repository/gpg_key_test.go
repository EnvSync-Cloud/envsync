package repository

import (
	"testing"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
)

// Regression: both mappers used to hardcode Status to "", which silently
// dropped the wire value. Everything filtering on key.Status (e.g. the active
// key picker for `gpg sign`) then saw an empty status and mis-filtered.
func TestGpgKeyMappersKeepStatus(t *testing.T) {
	list := sdkGpgKeyToResponse(&sdk.GpgKeyResponse{Id: "k1", Status: "active"})
	if list.Status != "active" {
		t.Errorf("sdkGpgKeyToResponse Status = %q, want %q", list.Status, "active")
	}

	detail := sdkGpgKeyDetailToResponse(&sdk.GpgKeyDetailResponse{Id: "k1", Status: "revoked"})
	if detail.Status != "revoked" {
		t.Errorf("sdkGpgKeyDetailToResponse Status = %q, want %q", detail.Status, "revoked")
	}
}
