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