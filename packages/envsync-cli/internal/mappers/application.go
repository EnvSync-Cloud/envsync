package mappers

import (
	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
)

func AppResponseToDomain(res responses.AppResponse) domain.Application {
	envTypes := make([]domain.EnvType, len(res.EnvTypes))
	for i, envType := range res.EnvTypes {
		envTypes[i] = domain.EnvType{
			ID:   envType.ID,
			Name: envType.Name,
		}
	}

	return domain.Application{
		ID:              res.ID,
		Name:            res.Name,
		Description:     res.Description,
		Metadata:        res.Metadata,
		OrgID:           res.OrgID,
		EnvTypes:        envTypes,
		EnvCount:        res.EnvCount,
		PublicKey:       res.PublicKey,
		EnableSecrets:   res.EnableSecrets,
		IsManagedSecret: res.IsManagedSecret,
		CreatedAt:       res.CreatedAt,
		UpdatedAt:       res.UpdatedAt,
	}
}

func DomainToAppRequest(app *domain.Application) requests.ApplicationRequest {
	var metaData map[string]any

	if app.Metadata != nil {
		metaData = make(map[string]any, len(app.Metadata))
		for k, v := range app.Metadata {
			metaData[k] = v
		}
	} else {
		metaData = make(map[string]any, 0)
	}

	return requests.ApplicationRequest{
		Name:            app.Name,
		Description:     app.Description,
		Metadata:        metaData,
		PublicKey:       app.PublicKey,
		EnableSecrets:   app.EnableSecrets,
		IsManagedSecret: app.IsManagedSecret,
	}
}
