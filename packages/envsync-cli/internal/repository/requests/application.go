package requests

type ApplicationRequest struct {
	Name            string         `json:"name"`
	Description     string         `json:"description"`
	Metadata        map[string]any `json:"metadata"`
	EnableSecrets   bool           `json:"enable_secrets"`
	PublicKey       string         `json:"public_key"`
	IsManagedSecret bool           `json:"is_managed_secret"`
}
