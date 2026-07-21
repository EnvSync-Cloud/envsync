package repository

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	sdkclient "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/client"
)

type ServiceTokenRepository interface {
	Create(ctx context.Context, req *sdk.CreateServiceTokenRequest) (*sdk.CreateServiceTokenResponse, error)
	GetAll(ctx context.Context) (sdk.ServiceTokensResponse, error)
	GetByID(ctx context.Context, id string) (*sdk.ServiceTokenResponse, error)
	Delete(ctx context.Context, id string) error
}

type serviceTokenRepo struct {
	client *sdkclient.Client
}

func NewServiceTokenRepository() ServiceTokenRepository {
	client := createSDKClient()
	return &serviceTokenRepo{
		client: client,
	}
}

func (r *serviceTokenRepo) Create(ctx context.Context, req *sdk.CreateServiceTokenRequest) (*sdk.CreateServiceTokenResponse, error) {
	return r.client.ServiceTokens.CreateServiceToken(ctx, req)
}

func (r *serviceTokenRepo) GetAll(ctx context.Context) (sdk.ServiceTokensResponse, error) {
	return r.client.ServiceTokens.GetAllServiceTokens(ctx)
}

func (r *serviceTokenRepo) GetByID(ctx context.Context, id string) (*sdk.ServiceTokenResponse, error) {
	return r.client.ServiceTokens.GetServiceToken(ctx, id)
}

func (r *serviceTokenRepo) Delete(ctx context.Context, id string) error {
	_, err := r.client.ServiceTokens.DeleteServiceToken(ctx, id)
	return err
}
