package handlers

import (
	"context"
	"fmt"

	genpem "github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/gen_pem"
	"github.com/urfave/cli/v3"
)

type GenPEMKeyHandler struct {
	genKeyPairUseCase genpem.GenKeyPairUseCase
}

func NewGenPEMKeyHandler(guc genpem.GenKeyPairUseCase) *GenPEMKeyHandler {
	return &GenPEMKeyHandler{
		genKeyPairUseCase: guc,
	}
}

func (h *GenPEMKeyHandler) GeneratePEMKey(ctx context.Context, cmd *cli.Command) error {
	output := cmd.String("output")

	if err := h.genKeyPairUseCase.GenerateKeyPair(ctx, output); err != nil {
		return err
	}

	// If the key pair generation is successful, return a success message
	fmt.Println("PEM key pair generated successfully.")

	return nil
}
