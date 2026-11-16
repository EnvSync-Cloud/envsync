package auth

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"math/big"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Key is the CLI session key. A copied access token is useless without it.
type Key struct {
	Private *ecdsa.PrivateKey
}

func GenerateKey() (*Key, error) {
	private, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}
	return &Key{Private: private}, nil
}

func LoadOrCreateKey(path string) (*Key, error) {
	if raw, err := os.ReadFile(path); err == nil {
		return parseKey(raw)
	}
	key, err := GenerateKey()
	if err != nil {
		return nil, err
	}
	if err := key.Save(path); err != nil {
		return nil, err
	}
	return key, nil
}

func (k *Key) Save(path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	der, err := x509.MarshalECPrivateKey(k.Private)
	if err != nil {
		return err
	}
	encoded := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: der})
	return os.WriteFile(path, encoded, 0o600)
}

func DeleteKey(path string) error {
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func KeyPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "envsync", "dpop-key.pem"), nil
}

// Proof signs a DPoP JWT. accessToken is included as ath when it is not empty.
func (k *Key) Proof(method, rawURL, accessToken string) (string, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}
	parsed.RawQuery = ""
	parsed.Fragment = ""
	x, y := coordinates(&k.Private.PublicKey)
	header := map[string]any{
		"typ": "dpop+jwt",
		"alg": "ES256",
		"jwk": map[string]string{"kty": "EC", "crv": "P-256", "x": x, "y": y},
	}
	payload := map[string]any{
		"htm": strings.ToUpper(method),
		"htu": parsed.String(),
		"iat": time.Now().Unix(),
		"jti": randomID(),
	}
	if accessToken != "" {
		sum := sha256.Sum256([]byte(accessToken))
		payload["ath"] = base64.RawURLEncoding.EncodeToString(sum[:])
	}
	headerJSON, _ := json.Marshal(header)
	payloadJSON, _ := json.Marshal(payload)
	unsigned := base64.RawURLEncoding.EncodeToString(headerJSON) + "." + base64.RawURLEncoding.EncodeToString(payloadJSON)
	digest := sha256.Sum256([]byte(unsigned))
	r, s, err := ecdsa.Sign(rand.Reader, k.Private, digest[:])
	if err != nil {
		return "", err
	}
	signature := append(pad32(r), pad32(s)...)
	return unsigned + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}

func parseKey(raw []byte) (*Key, error) {
	block, _ := pem.Decode(raw)
	if block == nil {
		return nil, fmt.Errorf("dpop key is not PEM")
	}
	private, err := x509.ParseECPrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	return &Key{Private: private}, nil
}

func coordinates(pub *ecdsa.PublicKey) (string, string) {
	ecdhKey, err := pub.ECDH()
	if err != nil {
		return "", ""
	}
	raw := ecdhKey.Bytes()
	return base64.RawURLEncoding.EncodeToString(raw[1:33]), base64.RawURLEncoding.EncodeToString(raw[33:65])
}

func pad32(value *big.Int) []byte {
	out := make([]byte, 32)
	value.FillBytes(out)
	return out
}

func randomID() string {
	buf := make([]byte, 16)
	_, _ = rand.Read(buf)
	return base64.RawURLEncoding.EncodeToString(buf)
}
