package genpem

import "context"

type GenKeyPairUseCase interface {
	GenerateKeyPair(context.Context, string) error
}
