package domain

import "time"

type Application struct {
	ID              string
	Name            string
	Description     string
	Metadata        map[string]any
	OrgID           string
	EnvTypes        []EnvType
	EnvCount        string
	PublicKey       string
	EnableSecrets   bool
	IsManagedSecret bool
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

func NewApplication(name, description, publicKey string, enableSecrets bool, metadata map[string]any) *Application {
	return &Application{
		Name:          name,
		Description:   description,
		Metadata:      metadata,
		PublicKey:     publicKey,
		EnableSecrets: enableSecrets,
	}
}
