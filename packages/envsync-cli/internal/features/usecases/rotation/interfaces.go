package rotation

import (
	"context"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"
)

type ListPoliciesUseCase interface {
	Execute(ctx context.Context, req *sdk.GetRotationPoliciesRequest) (sdk.RotationPoliciesResponse, error)
}

type CreatePolicyUseCase interface {
	Execute(ctx context.Context, req *sdk.CreateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error)
}

type GetPolicyUseCase interface {
	Execute(ctx context.Context, id string) (*sdk.RotationPolicyResponse, error)
}

type UpdatePolicyUseCase interface {
	Execute(ctx context.Context, id string, req *sdk.UpdateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error)
}

type DeletePolicyUseCase interface {
	Execute(ctx context.Context, id string) error
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
