package genpem

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/utils"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var (
	defaultPublicKeyFile  = "public_key.pem"
	defaultPrivateKeyFile = "private_key.pem"
)

type genKeyPairUseCase struct{}

func NewGenKeyPairUseCase() GenKeyPairUseCase {
	return &genKeyPairUseCase{}
}

// GenerateKeyPair implements GenKeyPairUseCase.
func (g *genKeyPairUseCase) GenerateKeyPair(ctx context.Context, output string) (err error) {
	ctx, end := telemetry.StartSpan(ctx, "gen_pem.generate_key_pair",
		trace.WithAttributes(attribute.String("file.path", output)))
	defer end(&err)

	keyPair, err := utils.GenerateKeyPair()
	if err != nil {
		return err
	}

	if err := g.saveKeyPair(keyPair, output); err != nil {
		return err
	}

	return nil
}

func (g *genKeyPairUseCase) saveKeyPair(keys *utils.KeyPair, output string) error {
	if err := g.savePublicKey(keys.PublicKey, output); err != nil {
		return err
	}
	if err := g.savePrivateKey(keys.PrivateKey, output); err != nil {
		return err
	}
	return nil

}

func (g *genKeyPairUseCase) savePublicKey(key string, output string) error {
	if output != "" {
		return utils.WriteFile(key, output+"/"+defaultPublicKeyFile)
	}

	// If no output directory is specified, save to current directory
	if err := utils.WriteFile(key, "./"+defaultPublicKeyFile); err != nil {
		return err
	}

	return nil
}

func (g *genKeyPairUseCase) savePrivateKey(key string, output string) error {
	if output != "" {
		return utils.WriteFile(key, output+"/"+defaultPrivateKeyFile)
	}

	// If no output directory is specified, save to current directory
	if err := utils.WriteFile(key, "./"+defaultPrivateKeyFile); err != nil {
		return err
	}

	return nil
}
