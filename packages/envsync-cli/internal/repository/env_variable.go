package repository

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	sdkclient "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/client"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
)

type EnvVariableRepository interface {
	GetAllEnv(ctx context.Context) ([]responses.EnvironmentVariable, error)
	BatchCreateEnv(ctx context.Context, env requests.BatchSyncEnvRequest) error
	BatchUpdateEnv(ctx context.Context, env requests.BatchSyncEnvRequest) error
	BatchDeleteEnv(ctx context.Context, env requests.BatchDeleteRequest) error
}

type syncRepo struct {
	client *sdkclient.Client
	ref    domain.ProjectEnvRef
}

func NewEnvVariableRepository(ref domain.ProjectEnvRef) EnvVariableRepository {
	client := createSDKClient()

	return &syncRepo{
		client: client,
		ref:    ref,
	}
}

func (s *syncRepo) GetAllEnv(ctx context.Context) ([]responses.EnvironmentVariable, error) {
	scope := scopeFromRef(s.ref)
	envs, err := s.client.EnvironmentVariables.GetEnvs(ctx, &sdk.GetEnvRequest{
		AppId:       scope.appID,
		AppName:     scope.appName,
		EnvTypeId:   scope.envTypeID,
		EnvTypeName: scope.envTypeName,
	})
	if err != nil {
		return nil, err
	}

	result := make([]responses.EnvironmentVariable, len(envs))
	for i, env := range envs {
		result[i] = responses.EnvironmentVariable{
			ID:        env.Id,
			Key:       env.Key,
			Value:     env.Value,
			AppID:     env.AppId,
			EnvTypeID: env.EnvTypeId,
			OrgID:     env.OrgId,
			CreatedAt: env.CreatedAt,
			UpdatedAt: env.UpdatedAt,
		}
	}

	return result, nil
}

func (s *syncRepo) BatchCreateEnv(ctx context.Context, env requests.BatchSyncEnvRequest) error {
	sdkEnvs := make([]*sdk.BatchCreateEnvsRequestEnvsItem, len(env.Envs))
	for i, e := range env.Envs {
		sdkEnvs[i] = &sdk.BatchCreateEnvsRequestEnvsItem{
			Key:   e.Key,
			Value: e.Value,
		}
	}

	scope := scopeFromRef(domain.ProjectEnvRef{
		AppID: env.AppID, AppName: env.AppName, EnvTypeID: env.EnvTypeID, EnvTypeName: env.EnvTypeName,
	})
	_, err := s.client.EnvironmentVariables.BatchCreateEnvs(ctx, &sdk.BatchCreateEnvsRequest{
		AppId:       scope.appID,
		AppName:     scope.appName,
		EnvTypeId:   scope.envTypeID,
		EnvTypeName: scope.envTypeName,
		Envs:        sdkEnvs,
	})
	return err
}

func (s *syncRepo) BatchUpdateEnv(ctx context.Context, env requests.BatchSyncEnvRequest) error {
	sdkEnvs := make([]*sdk.BatchCreateEnvsRequestEnvsItem, len(env.Envs))
	for i, e := range env.Envs {
		sdkEnvs[i] = &sdk.BatchCreateEnvsRequestEnvsItem{
			Key:   e.Key,
			Value: e.Value,
		}
	}

	scope := scopeFromRef(domain.ProjectEnvRef{
		AppID: env.AppID, AppName: env.AppName, EnvTypeID: env.EnvTypeID, EnvTypeName: env.EnvTypeName,
	})
	_, err := s.client.EnvironmentVariables.BatchUpdateEnvs(ctx, &sdk.BatchCreateEnvsRequest{
		AppId:       scope.appID,
		AppName:     scope.appName,
		EnvTypeId:   scope.envTypeID,
		EnvTypeName: scope.envTypeName,
		Envs:        sdkEnvs,
	})
	return err
}

func (s *syncRepo) BatchDeleteEnv(ctx context.Context, env requests.BatchDeleteRequest) error {
	scope := scopeFromRef(domain.ProjectEnvRef{
		AppID: env.AppID, AppName: env.AppName, EnvTypeID: env.EnvTypeID, EnvTypeName: env.EnvTypeName,
	})
	_, err := s.client.EnvironmentVariables.DeleteBatchEnv(ctx, &sdk.BatchDeleteEnvsRequest{
		AppId:       scope.appID,
		AppName:     scope.appName,
		EnvTypeId:   scope.envTypeID,
		EnvTypeName: scope.envTypeName,
		Keys:        env.Keys,
	})
	return err
}
