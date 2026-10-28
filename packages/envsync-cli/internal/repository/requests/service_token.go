package requests

// CreateServiceTokenRequest mirrors the API contract: the optional fields are
// pointers so "absent" (server default applies) stays distinguishable from an
// explicit empty value.
type CreateServiceTokenRequest struct {
	Name          string                         `json:"name"`
	AppId         *string                        `json:"app_id,omitempty"`
	EnvTypeId     *string                        `json:"env_type_id,omitempty"`
	Permissions   *ServiceTokenPermissionRequest `json:"permissions,omitempty"`
	Scopes        []*ServiceTokenScopeRequest    `json:"scopes,omitempty"`
	ExpiresInDays *int                           `json:"expires_in_days,omitempty"`
}

type ServiceTokenPermissionRequest struct {
	Read  bool `json:"read"`
	Write bool `json:"write"`
}

type ServiceTokenScopeRequest struct {
	// EnvTypeId is optional: a scope without it applies to every environment.
	EnvTypeId *string `json:"env_type_id,omitempty"`
	Path      string  `json:"path"`
}
