package domain

import (
	"strings"
	"time"
)

// GpgAlgorithmOption is one selectable key algorithm for generation. The
// label is what users see; the value is what the API expects.
type GpgAlgorithmOption struct {
	Label   string
	Value   string
	KeySize *int
}

// GpgAlgorithmOptions lists the algorithms `gpg generate` accepts. RSA is
// pinned to 4096 bits; the ECC curves take no key size.
func GpgAlgorithmOptions() []GpgAlgorithmOption {
	rsaKeySize := 4096
	return []GpgAlgorithmOption{
		{Label: "ECC Curve25519", Value: "ecc-curve25519"},
		{Label: "ECC P-256", Value: "ecc-p256"},
		{Label: "ECC P-384", Value: "ecc-p384"},
		{Label: "RSA 4096", Value: "rsa", KeySize: &rsaKeySize},
	}
}

// ResolveGpgAlgorithm matches user input against the accepted algorithm list.
// Input may be a label ("RSA 4096") or an API value ("rsa"); matching ignores
// case and separator characters.
func ResolveGpgAlgorithm(input string) (GpgAlgorithmOption, bool) {
	want := normalizeGpgAlgorithm(input)
	if want == "" {
		return GpgAlgorithmOption{}, false
	}
	for _, o := range GpgAlgorithmOptions() {
		if want == normalizeGpgAlgorithm(o.Label) || want == normalizeGpgAlgorithm(o.Value) {
			return o, true
		}
	}
	return GpgAlgorithmOption{}, false
}

func normalizeGpgAlgorithm(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	return strings.Map(func(r rune) rune {
		switch r {
		case ' ', '-', '_':
			return -1
		}
		return r
	}, s)
}

// SignModes lists the signing modes `gpg sign` accepts.
func SignModes() []string {
	return []string{"binary", "text", "clearsign"}
}

// ResolveSignMode matches user input against the accepted signing modes.
// Matching ignores case and surrounding space.
func ResolveSignMode(input string) (string, bool) {
	got := strings.ToLower(strings.TrimSpace(input))
	for _, mode := range SignModes() {
		if got == mode {
			return mode, true
		}
	}
	return "", false
}

type GpgKey struct {
	ID                 string     `json:"id"`
	Name               string     `json:"name"`
	Email              string     `json:"email"`
	Fingerprint        string     `json:"fingerprint"`
	KeyID              string     `json:"key_id"`
	Algorithm          string     `json:"algorithm"`
	KeySize            *int       `json:"key_size,omitempty"`
	UsageFlags         []string   `json:"usage_flags"`
	TrustLevel         string     `json:"trust_level"`
	Status             string     `json:"status"`
	ExpiresAt          *time.Time `json:"expires_at,omitempty"`
	RevokedAt          *time.Time `json:"revoked_at,omitempty"`
	IsDefault          bool       `json:"is_default"`
	SupersedesGpgKeyID *string    `json:"supersedes_gpg_key_id,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type GpgSignRequest struct {
	KeyID    string
	Data     string
	Mode     string
	Detached bool
}

type GpgSignatureResult struct {
	Signature   string `json:"signature"`
	KeyID       string `json:"key_id"`
	Fingerprint string `json:"fingerprint"`
}

type GpgVerifyResult struct {
	Valid             bool    `json:"valid"`
	SignerFingerprint *string `json:"signer_fingerprint,omitempty"`
	SignerKeyID       *string `json:"signer_key_id,omitempty"`
}
