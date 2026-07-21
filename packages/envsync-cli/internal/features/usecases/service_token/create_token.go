package service_token

import (
	"context"
	"strings"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type createServiceTokenUseCase struct {
	service services.ServiceTokenService
}

func NewCreateServiceTokenUseCase() CreateServiceTokenUseCase {
	return &createServiceTokenUseCase{
		service: services.NewServiceTokenService(),
	}
}

func (uc *createServiceTokenUseCase) Execute(ctx context.Context, req *sdk.CreateServiceTokenRequest) (*sdk.CreateServiceTokenResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "service_token.create")
	defer span.End()

	if strings.TrimSpace(req.Name) == "" {
		return nil, NewServiceTokenValidationError("service token name cannot be empty", ErrTokenNameRequired)
	}

	resp, err := uc.service.CreateServiceToken(ctx, req)
	if err != nil {
		return nil, NewServiceTokenServiceError("failed to create service token", err)
	}

	return resp, nil
}
