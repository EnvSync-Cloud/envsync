package services

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	"github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/rotation"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type RotationService interface {
	ListPolicies(ctx context.Context, req *sdk.GetRotationPoliciesRequest) (sdk.RotationPoliciesResponse, error)
	GetPolicy(ctx context.Context, id string) (*sdk.RotationPolicyResponse, error)
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

func (s *rotationService) ListPolicies(ctx context.Context, req *sdk.GetRotationPoliciesRequest) (result sdk.RotationPoliciesResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.rotation.list_policies")
	defer end(&err)

	return s.client.GetRotationPolicies(ctx, req)
}

func (s *rotationService) GetPolicy(ctx context.Context, id string) (result *sdk.RotationPolicyResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.rotation.get_policy")
	defer end(&err)

	return s.client.GetRotationPolicy(ctx, id)
}

func (s *rotationService) TriggerRotation(ctx context.Context, id string) (result *sdk.TriggerRotationResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.rotation.trigger_rotation")
	defer end(&err)

	return s.client.TriggerRotation(ctx, id)
}

func (s *rotationService) GetRotationStates(ctx context.Context, id string) (result sdk.RotationStatesResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.rotation.get_rotation_states")
	defer end(&err)

	return s.client.GetRotationStates(ctx, id)
}

func (s *rotationService) RevokeExpiredCredentials(ctx context.Context) (result *sdk.RevokeOldCredentialResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.rotation.revoke_expired_credentials")
	defer end(&err)

	return s.client.RevokeExpiredCredentials(ctx)
}
