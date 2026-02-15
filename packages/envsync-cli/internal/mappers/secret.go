package mappers

import (
	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
)

func SecretResponseToDomain(res responses.SecretResponse) domain.Secret {
	return domain.Secret{
		ID:        res.ID,
		Key:       res.Key,
		Value:     res.Value,
		EnvTypeID: res.EnvTypeID,
		AppID:     res.AppID,
		OrgID:     res.OrgID,
		CreatedAt: res.CreatedAt,
		UpdatedAt: res.UpdatedAt,
	}
}
