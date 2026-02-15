package mappers

import (
	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
)

func EnvironmentVariableToDomain(env responses.EnvironmentVariable) *domain.EnvironmentVariable {
	return &domain.EnvironmentVariable{
		Key:   env.Key,
		Value: env.Value,
	}
}

func EnvironmentVariablesToDomain(envs []responses.EnvironmentVariable) []*domain.EnvironmentVariable {
	var domainEnvs []*domain.EnvironmentVariable
	for _, env := range envs {
		domainEnvs = append(domainEnvs, EnvironmentVariableToDomain(env))
	}
	return domainEnvs
}

func EnvironmentVariableToBatchRequest(envs []domain.EnvironmentVariable, appID, envTypeID string) requests.BatchSyncEnvRequest {
	batchRequests := requests.BatchSyncEnvRequest{
		AppID:     appID,
		EnvTypeID: envTypeID,
		Envs:      make([]requests.EnvVariable, len(envs)),
	}

	for i, env := range envs {
		batchRequests.Envs[i] = requests.EnvVariable{
			Key:   env.Key,
			Value: env.Value,
		}
	}

	return batchRequests
}

func KeysToBatchDeleteRequest(envs []string, appID, envTypeID string) requests.BatchDeleteRequest {
	batchRequests := requests.BatchDeleteRequest{
		AppID:     appID,
		EnvTypeID: envTypeID,
		Keys:      make([]string, len(envs)),
	}

	copy(batchRequests.Keys, envs)

	return batchRequests
}
