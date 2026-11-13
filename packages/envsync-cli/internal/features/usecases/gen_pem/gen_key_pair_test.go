package genpem

import (
	"os"
	"path/filepath"
	"testing"
)

func TestPrivateKeyFileMode(t *testing.T) {
	dir := t.TempDir()
	uc := &genKeyPairUseCase{}
	if err := uc.savePrivateKey("-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n", dir); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(filepath.Join(dir, defaultPrivateKeyFile))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("private key mode = %#o, want 0600", info.Mode().Perm())
	}
}
