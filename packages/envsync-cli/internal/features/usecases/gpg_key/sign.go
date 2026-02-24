package gpg_key

import (
	"context"
	"encoding/base64"
	"io"
	"os"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
)

type signUseCase struct {
	service services.GpgKeyService
}

func NewSignUseCase() SignUseCase {
	service := services.NewGpgKeyService()
	return &signUseCase{service: service}
}

func (uc *signUseCase) Execute(ctx context.Context, keyID, filePath, mode string, detached bool, useStdin bool) (*domain.GpgSignatureResult, error) {
	if keyID == "" {
		return nil, NewValidationError("key ID is required", ErrKeyIDRequired)
	}

	var data []byte
	var err error

	if filePath != "" {
		data, err = os.ReadFile(filePath)
		if err != nil {
			return nil, NewIOError("failed to read file", err)
		}
	} else if useStdin {
		data, err = io.ReadAll(os.Stdin)
		if err != nil {
			return nil, NewIOError("failed to read from stdin", err)
		}
	} else {
		return nil, NewValidationError("no input provided", ErrNoInputProvided)
	}

	encoded := base64.StdEncoding.EncodeToString(data)

	req := requests.SignDataRequest{
		GpgKeyID: keyID,
		Data:     encoded,
		Mode:     mode,
		Detached: detached,
	}

	result, err := uc.service.Sign(ctx, req)
	if err != nil {
		return nil, NewServiceError("failed to sign data", err)
	}

	return &result, nil
}
