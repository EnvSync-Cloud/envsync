package init

import "context"

type InitUseCase interface {
	Execute(context.Context, string) error
	ExecuteWithOptions(ctx context.Context, config string, appID string, envTypeID string) error
}
