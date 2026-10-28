package init

import "context"

type InitUseCase interface {
	Execute(context.Context, string) (InitResult, error)
	ExecuteWithOptions(ctx context.Context, config string, appID string, envTypeID string) (InitResult, error)
}

// InitResult describes the configuration a successful init wrote.
type InitResult struct {
	Path      string `json:"path"`
	AppID     string `json:"app_id"`
	EnvTypeID string `json:"env_type_id"`
}
