package init

import "context"

type InitUseCase interface {
	Execute(context.Context, string) error
}
