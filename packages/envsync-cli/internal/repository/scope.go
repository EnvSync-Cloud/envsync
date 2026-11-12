package repository

import (
	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
)

type apiScope struct {
	appID       *string
	appName     *string
	envTypeID   *string
	envTypeName *string
}

func scopeFromRef(ref domain.ProjectEnvRef) apiScope {
	scope := apiScope{}
	if ref.AppName != "" {
		scope.appName = sdk.String(ref.AppName)
	} else if ref.AppID != "" {
		scope.appID = sdk.String(ref.AppID)
	}
	if ref.EnvTypeName != "" {
		scope.envTypeName = sdk.String(ref.EnvTypeName)
	} else if ref.EnvTypeID != "" {
		scope.envTypeID = sdk.String(ref.EnvTypeID)
	}
	return scope
}
