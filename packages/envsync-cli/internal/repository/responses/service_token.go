package responses

import "time"

type ServiceTokenResponse struct {
	Id            string                 `json:"id"`
	Name          string                 `json:"name"`
	AppId         string                 `json:"app_id"`
	EnvTypeId     string                 `json:"env_type_id"`
	Permissions   ServiceTokenPermission `json:"permissions"`
	Scopes        []ServiceTokenScope    `json:"scopes"`
	Token         string                 `json:"token,omitempty"`
	RotatedFromId string                 `json:"rotated_from_id"`
	GraceUntil    *time.Time             `json:"grace_until"`
	ExpiresAt     time.Time              `json:"expires_at"`
	LastUsedAt    *time.Time             `json:"last_used_at"`
	CreatedAt     time.Time              `json:"created_at"`
}

type ServiceTokenPermission struct {
	Read  bool `json:"read"`
	Write bool `json:"write"`
}

type ServiceTokenScope struct {
	EnvTypeId string `json:"env_type_id"`
	Path      string `json:"path"`
}
