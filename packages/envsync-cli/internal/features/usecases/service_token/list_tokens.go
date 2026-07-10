package service_token

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type listServiceTokensUseCase struct {
	service services.ServiceTokenService
}

func NewListServiceTokensUseCase() ListServiceTokensUseCase {
	return &listServiceTokensUseCase{
		service: services.NewServiceTokenService(),
	}
}

func (uc *listServiceTokensUseCase) Execute(ctx context.Context) (sdk.ServiceTokensResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "service_token.list")
	defer span.End()

	tokens, err := uc.service.GetAllServiceTokens(ctx)
	if err != nil {
		return nil, NewServiceTokenServiceError("failed to list service tokens", err)
	}

	return tokens, nil
}
