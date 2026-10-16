package service_token

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
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

func (uc *listServiceTokensUseCase) Execute(ctx context.Context) (result []domain.ServiceToken, err error) {
	ctx, end := telemetry.StartSpan(ctx, "service_token.list")
	defer end(&err)

	tokens, err := uc.service.GetAllServiceTokens(ctx)
	if err != nil {
		return nil, NewServiceTokenServiceError("failed to list service tokens", err)
	}

	return tokens, nil
}
