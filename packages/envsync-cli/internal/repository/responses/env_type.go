package responses

import "time"

// EnvTypeResponse represents the response structure for environment types
type EnvTypeResponse struct {
	ID          string    `json:"id"`
	OrgID       string    `json:"org_id"`
	Name        string    `json:"name"`
	AppID       string    `json:"app_id"`
	IsDefault   bool      `json:"is_default"`
	IsProtected bool      `json:"is_protected"`
	Color       string    `json:"color"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func NewEnvTypeResponse(id, orgID, name, appID string, isDefault, isProtected bool, color string, createdAt, updatedAt time.Time) *EnvTypeResponse {
	return &EnvTypeResponse{
		ID:          id,
		OrgID:       orgID,
		Name:        name,
		AppID:       appID,
		IsDefault:   isDefault,
		IsProtected: isProtected,
		Color:       color,
		CreatedAt:   createdAt,
		UpdatedAt:   updatedAt,
	}
}
