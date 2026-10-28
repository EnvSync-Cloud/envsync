package domain

import (
	"fmt"
	"strings"
	"time"
)

// ParseMetadata turns repeated key=value entries into an application metadata
// map. Both the --metadata flag and the interactive form produce that shape.
func ParseMetadata(entries []string) (map[string]any, error) {
	if len(entries) == 0 {
		return nil, nil
	}

	out := make(map[string]any, len(entries))
	for _, entry := range entries {
		key, value, ok := strings.Cut(entry, "=")
		if !ok {
			return nil, fmt.Errorf("expected key=value, got %q", entry)
		}
		key = strings.TrimSpace(key)
		if key == "" {
			return nil, fmt.Errorf("empty key in %q", entry)
		}
		if _, duplicate := out[key]; duplicate {
			return nil, fmt.Errorf("duplicate metadata key %q", key)
		}
		out[key] = strings.TrimSpace(value)
	}

	return out, nil
}

type Application struct {
	ID              string         `json:"id"`
	Name            string         `json:"name"`
	Description     string         `json:"description,omitempty"`
	Metadata        map[string]any `json:"metadata,omitempty"`
	OrgID           string         `json:"org_id,omitempty"`
	EnvTypes        []EnvType      `json:"env_types,omitempty"`
	EnvCount        string         `json:"env_count,omitempty"`
	PublicKey       string         `json:"public_key,omitempty"`
	EnableSecrets   bool           `json:"enable_secrets"`
	IsManagedSecret bool           `json:"is_managed_secret"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}

func NewApplication(
	name,
	description,
	publicKey string,
	enableSecrets bool,
	metadata map[string]any,
) *Application {
	return &Application{
		Name:          name,
		Description:   description,
		Metadata:      metadata,
		PublicKey:     publicKey,
		EnableSecrets: enableSecrets,
	}
}

var (
	DefaultEnvTypes = []EnvType{
		{Name: "Production", Color: "#ef4444", IsDefault: false},
		{Name: "Development", Color: "#22c55e", IsDefault: false},
		{Name: "Staging", Color: "#f59e0b", IsDefault: false},
	}
)
