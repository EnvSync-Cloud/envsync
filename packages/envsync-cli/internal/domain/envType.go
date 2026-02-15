package domain

import "time"

type EnvType struct {
	ID          string
	OrgID       string
	AppID       string
	Name        string
	IsDefault   bool
	IsProtected bool
	Color       string
	CreatedAt   time.Time
	UpdatedAt   time.Time
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
