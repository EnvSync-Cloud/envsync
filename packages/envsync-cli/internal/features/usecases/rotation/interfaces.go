package rotation

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
)

type ListPoliciesUseCase interface {
	Execute(ctx context.Context, req *sdk.GetRotationPoliciesRequest) (sdk.RotationPoliciesResponse, error)
}

type GetPolicyUseCase interface {
	Execute(ctx context.Context, id string) (*sdk.RotationPolicyResponse, error)
}

type TriggerRotationUseCase interface {
	Execute(ctx context.Context, id string) (*sdk.TriggerRotationResponse, error)
}

type GetRotationStatesUseCase interface {
	Execute(ctx context.Context, id string) (sdk.RotationStatesResponse, error)
}

type RevokeExpiredCredentialsUseCase interface {
	Execute(ctx context.Context) (*sdk.RevokeOldCredentialResponse, error)
}
