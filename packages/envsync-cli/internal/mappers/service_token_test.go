package mappers

import (
	"testing"
	"time"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
)

// Unset request fields must stay absent: the API rejects empty app_id and
// expires_in_days below 1, so "not stated" has to marshal as omitted.
func TestDomainToServiceTokenRequest_OmitsUnsetFields(t *testing.T) {
	req := DomainToServiceTokenRequest(&domain.ServiceToken{Name: "bare"})

	if req.Name != "bare" {
		t.Errorf("Name = %q, want %q", req.Name, "bare")
	}
	if req.AppId != nil {
		t.Errorf("AppId = %v, want nil", *req.AppId)
	}
	if req.EnvTypeId != nil {
		t.Errorf("EnvTypeId = %v, want nil", *req.EnvTypeId)
	}
	if req.Permissions != nil {
		t.Errorf("Permissions = %v, want nil (server default applies)", *req.Permissions)
	}
	if req.ExpiresInDays != nil {
		t.Errorf("ExpiresInDays = %v, want nil (server default applies)", *req.ExpiresInDays)
	}
	if len(req.Scopes) != 0 {
		t.Errorf("len(Scopes) = %d, want 0", len(req.Scopes))
	}
}

func TestDomainToServiceTokenRequest_MapsStatedFields(t *testing.T) {
	permissions := &domain.ServiceTokenPermissions{Read: true, Write: false}
	d := &domain.ServiceToken{
		Name:          "full",
		AppID:         "app-1",
		EnvTypeID:     "env-1",
		Permissions:   permissions,
		ExpiresInDays: 30,
		Scopes: []domain.ServiceTokenScopes{
			{EnvTypeID: "env-1", Path: "/db"},
			{Path: "/cache"},
		},
	}

	req := DomainToServiceTokenRequest(d)

	if req.AppId == nil || *req.AppId != "app-1" {
		t.Errorf("AppId = %v, want app-1", req.AppId)
	}
	if req.EnvTypeId == nil || *req.EnvTypeId != "env-1" {
		t.Errorf("EnvTypeId = %v, want env-1", req.EnvTypeId)
	}
	if req.Permissions == nil || !req.Permissions.Read || req.Permissions.Write {
		t.Errorf("Permissions = %+v, want read=true write=false", req.Permissions)
	}
	if req.ExpiresInDays == nil || *req.ExpiresInDays != 30 {
		t.Errorf("ExpiresInDays = %v, want 30", req.ExpiresInDays)
	}
	// Two scopes must both survive: a make(len 0) regression crashed here.
	if len(req.Scopes) != 2 {
		t.Fatalf("len(Scopes) = %d, want 2", len(req.Scopes))
	}
	if req.Scopes[0].EnvTypeId == nil || *req.Scopes[0].EnvTypeId != "env-1" || req.Scopes[0].Path != "/db" {
		t.Errorf("Scopes[0] = %+v, want env-1//db", req.Scopes[0])
	}
	if req.Scopes[1].EnvTypeId != nil || req.Scopes[1].Path != "/cache" {
		t.Errorf("Scopes[1] = %+v, want unset env//cache", req.Scopes[1])
	}
}

func TestServiceTokenResponseToDomain(t *testing.T) {
	expires := time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC)
	created := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	lastUsed := time.Date(2026, 10, 5, 0, 0, 0, 0, time.UTC)

	res := responses.ServiceTokenResponse{
		Id:          "tok-1",
		Name:        "deployer",
		AppId:       "app-1",
		EnvTypeId:   "env-1",
		Token:       "st_live_secret",
		Permissions: responses.ServiceTokenPermission{Read: true, Write: true},
		Scopes: []responses.ServiceTokenScope{
			{EnvTypeId: "env-1", Path: "/db"},
			{Path: "/cache"},
		},
		RotatedFromId: "",
		ExpiresAt:     expires,
		LastUsedAt:    &lastUsed,
		CreatedAt:     created,
	}

	got := ServiceTokenResponseToDomain(res)

	if got.Token != "st_live_secret" {
		t.Errorf("Token = %q, want the create secret", got.Token)
	}
	if got.Permissions == nil || !got.Permissions.Read || !got.Permissions.Write {
		t.Errorf("Permissions = %+v, want read/write true", got.Permissions)
	}
	// Empty rotated_from_id means "not rotated", not "rotated to ''".
	if got.RotatedFromID != nil {
		t.Errorf("RotatedFromID = %v, want nil", *got.RotatedFromID)
	}
	if len(got.Scopes) != 2 {
		t.Fatalf("len(Scopes) = %d, want 2", len(got.Scopes))
	}
	if got.Scopes[0].EnvTypeID != "env-1" || got.Scopes[0].Path != "/db" {
		t.Errorf("Scopes[0] = %+v, want env-1//db", got.Scopes[0])
	}
	if got.Scopes[1].EnvTypeID != "" || got.Scopes[1].Path != "/cache" {
		t.Errorf("Scopes[1] = %+v, want unset env//cache", got.Scopes[1])
	}
	if !got.ExpiresAt.Equal(expires) || !got.CreatedAt.Equal(created) {
		t.Errorf("times not mapped: expires=%v created=%v", got.ExpiresAt, got.CreatedAt)
	}
	if got.LastUsedAt == nil || !got.LastUsedAt.Equal(lastUsed) {
		t.Errorf("LastUsedAt = %v, want %v", got.LastUsedAt, lastUsed)
	}

	res.RotatedFromId = "tok-0"
	got = ServiceTokenResponseToDomain(res)
	if got.RotatedFromID == nil || *got.RotatedFromID != "tok-0" {
		t.Errorf("RotatedFromID = %v, want tok-0", got.RotatedFromID)
	}
}
