package domain

import "time"

type ServiceToken struct {
	ID string `json:"id"`
	// Name is the user-visible token label.
	Name string `json:"name"`
	// AppID / EnvTypeID scope the token; empty means unscoped.
	AppID     string `json:"app_id,omitempty"`
	EnvTypeID string `json:"env_type_id,omitempty"`
	// Permissions is nil when the user did not state any: the server default
	// (read-only) then applies. Explicit answers are always sent, so a form
	// "no/no" creates a token without permissions.
	Permissions *ServiceTokenPermissions `json:"permissions,omitempty"`
	Scopes      []ServiceTokenScopes     `json:"scopes"`
	// Token holds the secret. It is only returned by create; list and get
	// never see it again.
	Token         string     `json:"token,omitempty"`
	ExpiresAt     time.Time  `json:"expires_at"`
	LastUsedAt    *time.Time `json:"last_used_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	RotatedFromID *string    `json:"rotated_from_id,omitempty"`
	GraceUntil    *time.Time `json:"grace_until,omitempty"`

	// ExpiresInDays is create input only: 0 means "server default".
	ExpiresInDays int `json:"-"`
}

type ServiceTokenPermissions struct {
	Read  bool `json:"read"`
	Write bool `json:"write"`
}

type ServiceTokenScopes struct {
	EnvTypeID string `json:"env_type_id"`
	Path      string `json:"path"`
}
