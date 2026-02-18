package requests

type GenerateGpgKeyRequest struct {
	Name          string   `json:"name"`
	Email         string   `json:"email"`
	Algorithm     string   `json:"algorithm"`
	KeySize       *int     `json:"key_size,omitempty"`
	UsageFlags    []string `json:"usage_flags"`
	ExpiresInDays *int     `json:"expires_in_days,omitempty"`
	IsDefault     bool     `json:"is_default"`
}

type SignDataRequest struct {
	GpgKeyID string `json:"gpg_key_id"`
	Data     string `json:"data"`
	Mode     string `json:"mode"`
	Detached bool   `json:"detached"`
}

type VerifySignatureRequest struct {
	Data      string  `json:"data"`
	Signature string  `json:"signature"`
	GpgKeyID  *string `json:"gpg_key_id,omitempty"`
}
