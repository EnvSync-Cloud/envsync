package repository

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	sdkclient "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/client"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
)

type SecretRepository interface {
	GetAll(ctx context.Context, appID string, envTypeID string) ([]responses.SecretResponse, error)
	Reveal(ctx context.Context, appID string, envTypeID string, keys []string) ([]responses.SecretResponse, error)
}

type secretRepo struct {
	client *sdkclient.Client
}

func NewSecretRepository() SecretRepository {
	client := createSDKClient()

	return &secretRepo{
		client: client,
	}
}

func (s *secretRepo) GetAll(ctx context.Context, appID, envTypeID string) ([]responses.SecretResponse, error) {
	secrets, err := s.client.Secrets.GetSecrets(ctx, &sdk.GetSecretRequest{
		AppId:     appID,
		EnvTypeId: envTypeID,
	})
	if err != nil {
		return nil, err
	}

	result := make([]responses.SecretResponse, len(secrets))
	for i, sec := range secrets {
		result[i] = responses.SecretResponse{
			ID:        sec.Id,
			Key:       sec.Key,
			Value:     sec.Value,
			AppID:     sec.AppId,
			EnvTypeID: sec.EnvTypeId,
			OrgID:     sec.OrgId,
			CreatedAt: sec.CreatedAt,
			UpdatedAt: sec.UpdatedAt,
		}
	}

	return result, nil
}

func (s *secretRepo) Reveal(ctx context.Context, appID, envTypeID string, keys []string) ([]responses.SecretResponse, error) {
	secrets, err := s.client.Secrets.RevealSecrets(ctx, &sdk.RevealSecretsRequest{
		AppId:     appID,
		EnvTypeId: envTypeID,
		Keys:      keys,
	})
	if err != nil {
		return nil, err
	}

	result := make([]responses.SecretResponse, len(secrets))
	for i, sec := range secrets {
		result[i] = responses.SecretResponse{
			ID:        sec.Id,
			Key:       sec.Key,
			Value:     sec.Value,
			AppID:     sec.AppId,
			EnvTypeID: sec.EnvTypeId,
			OrgID:     sec.OrgId,
			CreatedAt: sec.CreatedAt,
			UpdatedAt: sec.UpdatedAt,
		}
	}

	return result, nil
}
