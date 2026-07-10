package service_token

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
)

type CreateServiceTokenUseCase interface {
	Execute(ctx context.Context, req *sdk.CreateServiceTokenRequest) (*sdk.CreateServiceTokenResponse, error)
}

type ListServiceTokensUseCase interface {
	Execute(ctx context.Context) (sdk.ServiceTokensResponse, error)
}

type GetServiceTokenUseCase interface {
	Execute(ctx context.Context, id string) (*sdk.ServiceTokenResponse, error)
}

type DeleteServiceTokenUseCase interface {
	Execute(ctx context.Context, id string) error
}
