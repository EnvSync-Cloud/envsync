package services

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	"github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/rotation"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
)

type RotationService interface {
	ListPolicies(ctx context.Context, req *sdk.GetRotationPoliciesRequest) (sdk.RotationPoliciesResponse, error)
	CreatePolicy(ctx context.Context, req *sdk.CreateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error)
	GetPolicy(ctx context.Context, id string) (*sdk.RotationPolicyResponse, error)
	DeletePolicy(ctx context.Context, id string) (*sdk.ErrorResponse, error)
	UpdatePolicy(ctx context.Context, id string, req *sdk.UpdateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error)
	TriggerRotation(ctx context.Context, id string) (*sdk.TriggerRotationResponse, error)
	GetRotationStates(ctx context.Context, id string) (sdk.RotationStatesResponse, error)
	RevokeExpiredCredentials(ctx context.Context) (*sdk.RevokeOldCredentialResponse, error)
}

type rotationService struct {
	client *rotation.Client
}

func NewRotationService() RotationService {
	mgmtClient := repository.GetManagementClient()
	return &rotationService{
		client: mgmtClient.Rotation,
	}
}

func (s *rotationService) ListPolicies(ctx context.Context, req *sdk.GetRotationPoliciesRequest) (sdk.RotationPoliciesResponse, error) {
	return s.client.GetRotationPolicies(ctx, req)
}

func (s *rotationService) CreatePolicy(ctx context.Context, req *sdk.CreateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error) {
	return s.client.CreateRotationPolicy(ctx, req)
}

func (s *rotationService) GetPolicy(ctx context.Context, id string) (*sdk.RotationPolicyResponse, error) {
	return s.client.GetRotationPolicy(ctx, id)
}

func (s *rotationService) DeletePolicy(ctx context.Context, id string) (*sdk.ErrorResponse, error) {
	return s.client.DeleteRotationPolicy(ctx, id)
}

func (s *rotationService) UpdatePolicy(ctx context.Context, id string, req *sdk.UpdateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error) {
	return s.client.UpdateRotationPolicy(ctx, id, req)
}

func (s *rotationService) TriggerRotation(ctx context.Context, id string) (*sdk.TriggerRotationResponse, error) {
	return s.client.TriggerRotation(ctx, id)
}

func (s *rotationService) GetRotationStates(ctx context.Context, id string) (sdk.RotationStatesResponse, error) {
	return s.client.GetRotationStates(ctx, id)
}

func (s *rotationService) RevokeExpiredCredentials(ctx context.Context) (*sdk.RevokeOldCredentialResponse, error) {
	return s.client.RevokeExpiredCredentials(ctx)
}
