package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/binary"
	"encoding/pem"
	"errors"
	"fmt"
)

// KeyPair represents a public/private key pair
type KeyPair struct {
	PublicKey  string
	PrivateKey string
}

// GenerateKeyPair generates an RSA key pair with optimized 3072-bit keys
func GenerateKeyPair() (*KeyPair, error) {
	// Generate RSA key pair with 3072-bit modulus
	privateKey, err := rsa.GenerateKey(rand.Reader, 3072)
	if err != nil {
		return nil, fmt.Errorf("failed to generate private key: %w", err)
	}

	// Encode private key to PKCS#8 PEM format
	privateKeyDER, err := x509.MarshalPKCS8PrivateKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal private key: %w", err)
	}

	privateKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: privateKeyDER,
	})

	// Encode public key to SPKI PEM format
	publicKeyDER, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal public key: %w", err)
	}

	publicKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: publicKeyDER,
	})

	return &KeyPair{
		PublicKey:  string(publicKeyPEM),
		PrivateKey: string(privateKeyPEM),
	}, nil
}

// parsePublicKey parses a PEM-encoded public key
func parsePublicKey(publicKeyPEM string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(publicKeyPEM))
	if block == nil {
		return nil, errors.New("failed to decode PEM block")
	}

	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse public key: %w", err)
	}

	rsaPub, ok := pub.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("not an RSA public key")
	}

	return rsaPub, nil
}

// parsePrivateKey parses a PEM-encoded private key
func parsePrivateKey(privateKeyPEM string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(privateKeyPEM))
	if block == nil {
		return nil, errors.New("failed to decode PEM block")
	}

	priv, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key: %w", err)
	}

	rsaPriv, ok := priv.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("not an RSA private key")
	}

	return rsaPriv, nil
}

// hybridDecrypt decrypts data using hybrid decryption
func hybridDecrypt(encryptedData string, privateKeyPEM string) (string, error) {
	privateKey, err := parsePrivateKey(privateKeyPEM)
	if err != nil {
		return "", err
	}

	data, err := base64.StdEncoding.DecodeString(encryptedData)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	if len(data) < 2 {
		return "", errors.New("invalid encrypted data: too short")
	}

	// Extract components
	keyLength := binary.BigEndian.Uint16(data[0:2])
	offset := 2

	if len(data) < int(2+keyLength+12) {
		return "", errors.New("invalid encrypted data: insufficient length")
	}

	encryptedAESKey := data[offset : offset+int(keyLength)]
	offset += int(keyLength)

	iv := data[offset : offset+12]
	offset += 12

	encrypted := data[offset:]

	// Decrypt the AES key using RSA private key with OAEP padding
	aesKey, err := rsa.DecryptOAEP(sha256.New(), rand.Reader, privateKey, encryptedAESKey, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt AES key: %w", err)
	}

	// Decrypt the data using AES-192-GCM
	block, err := aes.NewCipher(aesKey)
	if err != nil {
		return "", fmt.Errorf("failed to create AES cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	decrypted, err := gcm.Open(nil, iv, encrypted, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt data: %w", err)
	}

	return string(decrypted), nil
}

// rsaDecryptSmall decrypts small data directly with RSA
func rsaDecryptSmall(encryptedData string, privateKeyPEM string) (string, error) {
	privateKey, err := parsePrivateKey(privateKeyPEM)
	if err != nil {
		return "", err
	}

	encrypted, err := base64.StdEncoding.DecodeString(encryptedData)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	decrypted, err := rsa.DecryptOAEP(sha256.New(), rand.Reader, privateKey, encrypted, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt with RSA: %w", err)
	}

	return string(decrypted), nil
}

// SmartDecrypt decrypts data based on the method prefix
func SmartDecrypt(encryptedData string, privateKeyPEM string) (string, error) {
	if len(encryptedData) < 4 {
		return "", errors.New("invalid encrypted data: too short")
	}

	method := encryptedData[:4]
	data := encryptedData[4:]

	switch method {
	case "RSA:":
		return rsaDecryptSmall(data, privateKeyPEM)
	case "HYB:":
		return hybridDecrypt(data, privateKeyPEM)
	default:
		return "", errors.New("unknown encryption method")
	}
}
