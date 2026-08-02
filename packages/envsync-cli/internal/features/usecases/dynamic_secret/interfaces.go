package dynamic_secret

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
)

type ListEnginesUseCase interface {
	Execute(ctx context.Context) (sdk.DynamicSecretEnginesResponse, error)
}

type CreateEngineUseCase interface {
	Execute(ctx context.Context, req *sdk.CreateDynamicSecretEngineRequest) (*sdk.DynamicSecretEngineResponse, error)
}

type GetEngineUseCase interface {
	Execute(ctx context.Context, id string) (*sdk.DynamicSecretEngineResponse, error)
}

type UpdateEngineUseCase interface {
	Execute(ctx context.Context, id string, req *sdk.UpdateDynamicSecretEngineRequest) (*sdk.DynamicSecretEngineResponse, error)
}

type DeleteEngineUseCase interface {
	Execute(ctx context.Context, id string) error
}

type ListLeasesUseCase interface {
	Execute(ctx context.Context, engineID string) (sdk.DynamicSecretLeasesResponse, error)
}

type CreateLeaseUseCase interface {
	Execute(ctx context.Context, engineID string, req *sdk.CreateDynamicSecretLeaseRequest) (*sdk.DynamicSecretLeaseResponse, error)
}

type GetLeaseUseCase interface {
	Execute(ctx context.Context, leaseID string) (*sdk.DynamicSecretLeaseResponse, error)
}

type RevokeLeaseUseCase interface {
	Execute(ctx context.Context, leaseID string) (*sdk.RevokeLeaseResponse, error)
}

type CleanupUseCase interface {
	Execute(ctx context.Context) (*sdk.CleanupResponse, error)
}
