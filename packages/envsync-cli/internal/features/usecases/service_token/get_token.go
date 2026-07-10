package service_token

import (
	"context"
	"strings"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type getServiceTokenUseCase struct {
	service services.ServiceTokenService
}

func NewGetServiceTokenUseCase() GetServiceTokenUseCase {
	return &getServiceTokenUseCase{
		service: services.NewServiceTokenService(),
	}
}

func (uc *getServiceTokenUseCase) Execute(ctx context.Context, id string) (*sdk.ServiceTokenResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "service_token.get")
	defer span.End()

	if strings.TrimSpace(id) == "" {
		return nil, NewServiceTokenValidationError("service token ID is required", ErrTokenIDRequired)
	}

	token, err := uc.service.GetServiceToken(ctx, id)
	if err != nil {
		return nil, NewServiceTokenServiceError("failed to get service token", err)
	}

	return token, nil
}
