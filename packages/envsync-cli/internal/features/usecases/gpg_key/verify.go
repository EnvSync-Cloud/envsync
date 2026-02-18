package gpg_key

import (
	"context"
	"encoding/base64"
	"os"
	"strings"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
)

type verifyUseCase struct {
	service services.GpgKeyService
}

func NewVerifyUseCase() VerifyUseCase {
	service := services.NewGpgKeyService()
	return &verifyUseCase{service: service}
}

func (uc *verifyUseCase) Execute(ctx context.Context, filePath, signaturePath, keyID string) (*domain.GpgVerifyResult, error) {
	if filePath == "" {
		return nil, NewValidationError("file path is required for verification", ErrFileNotFound)
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, NewIOError("failed to read data file", err)
	}

	var signature string
	if signaturePath != "" {
		sigData, err := os.ReadFile(signaturePath)
		if err != nil {
			return nil, NewIOError("failed to read signature file", err)
		}
		signature = strings.TrimSpace(string(sigData))
	}

	encodedData := base64.StdEncoding.EncodeToString(data)

	var keyIDPtr *string
	if keyID != "" {
		keyIDPtr = &keyID
	}

	req := requests.VerifySignatureRequest{
		Data:      encodedData,
		Signature: signature,
		GpgKeyID:  keyIDPtr,
	}

	result, err := uc.service.Verify(req)
	if err != nil {
		return nil, NewServiceError("failed to verify signature", err)
	}

	return &result, nil
}
