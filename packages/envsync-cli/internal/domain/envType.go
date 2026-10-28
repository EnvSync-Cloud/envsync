package domain

import "time"

type EnvType struct {
	ID          string    `json:"id"`
	OrgID       string    `json:"org_id,omitempty"`
	AppID       string    `json:"app_id,omitempty"`
	Name        string    `json:"name"`
	IsDefault   bool      `json:"is_default"`
	IsProtected bool      `json:"is_protected"`
	Color       string    `json:"color,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func NewEnvType(appID, name string, isDefault, isProtected bool, color string) *EnvType {
	return &EnvType{
		AppID:       appID,
		Name:        name,
		IsDefault:   isDefault,
		IsProtected: isProtected,
		Color:       color,
	}
}
