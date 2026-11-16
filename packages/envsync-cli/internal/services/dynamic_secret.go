package services

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	"github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/dynamicsecrets"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type DynamicSecretService interface {
	ListEngines(ctx context.Context) (sdk.DynamicSecretEnginesResponse, error)
	CreateEngine(ctx context.Context, req *sdk.CreateDynamicSecretEngineRequest) (*sdk.DynamicSecretEngineResponse, error)
	GetEngine(ctx context.Context, id string) (*sdk.DynamicSecretEngineResponse, error)
	DeleteEngine(ctx context.Context, id string) (*sdk.ErrorResponse, error)
	UpdateEngine(ctx context.Context, id string, req *sdk.UpdateDynamicSecretEngineRequest) (*sdk.DynamicSecretEngineResponse, error)
	ListLeases(ctx context.Context, engineID string) (sdk.DynamicSecretLeasesResponse, error)
	CreateLease(ctx context.Context, engineID string, req *sdk.CreateDynamicSecretLeaseRequest) (*sdk.DynamicSecretLeaseResponse, error)
	GetLease(ctx context.Context, leaseID string) (*sdk.DynamicSecretLeaseResponse, error)
	RevokeLease(ctx context.Context, leaseID string) (*sdk.RevokeLeaseResponse, error)
	CleanupExpiredLeases(ctx context.Context) (*sdk.CleanupResponse, error)
}

type dynamicSecretService struct {
	client *dynamicsecrets.Client
}

func NewDynamicSecretService() DynamicSecretService {
	mgmtClient := repository.GetManagementClient()
	return &dynamicSecretService{
		client: mgmtClient.DynamicSecrets,
	}
}

func (s *dynamicSecretService) ListEngines(ctx context.Context) (result sdk.DynamicSecretEnginesResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.dynamic_secret.list_engines")
	defer end(&err)

	return s.client.GetAllDynamicSecretEngines(ctx)
}

func (s *dynamicSecretService) CreateEngine(ctx context.Context, req *sdk.CreateDynamicSecretEngineRequest) (result *sdk.DynamicSecretEngineResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.dynamic_secret.create_engine")
	defer end(&err)

	return s.client.CreateDynamicSecretEngine(ctx, req)
}

func (s *dynamicSecretService) GetEngine(ctx context.Context, id string) (result *sdk.DynamicSecretEngineResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.dynamic_secret.get_engine")
	defer end(&err)

	return s.client.GetDynamicSecretEngine(ctx, id)
}

func (s *dynamicSecretService) DeleteEngine(ctx context.Context, id string) (result *sdk.ErrorResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.dynamic_secret.delete_engine")
	defer end(&err)

	return s.client.DeleteDynamicSecretEngine(ctx, id)
}

func (s *dynamicSecretService) UpdateEngine(ctx context.Context, id string, req *sdk.UpdateDynamicSecretEngineRequest) (result *sdk.DynamicSecretEngineResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.dynamic_secret.update_engine")
	defer end(&err)

	return s.client.UpdateDynamicSecretEngine(ctx, id, req)
}

func (s *dynamicSecretService) ListLeases(ctx context.Context, engineID string) (result sdk.DynamicSecretLeasesResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.dynamic_secret.list_leases")
	defer end(&err)

	return s.client.GetDynamicSecretLeases(ctx, engineID)
}

func (s *dynamicSecretService) CreateLease(ctx context.Context, engineID string, req *sdk.CreateDynamicSecretLeaseRequest) (result *sdk.DynamicSecretLeaseResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.dynamic_secret.create_lease")
	defer end(&err)

	return s.client.CreateDynamicSecretLease(ctx, engineID, req)
}

func (s *dynamicSecretService) GetLease(ctx context.Context, leaseID string) (result *sdk.DynamicSecretLeaseResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.dynamic_secret.get_lease")
	defer end(&err)

	return s.client.GetDynamicSecretLease(ctx, leaseID)
}

func (s *dynamicSecretService) RevokeLease(ctx context.Context, leaseID string) (result *sdk.RevokeLeaseResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.dynamic_secret.revoke_lease")
	defer end(&err)

	return s.client.RevokeDynamicSecretLease(ctx, leaseID)
}

func (s *dynamicSecretService) CleanupExpiredLeases(ctx context.Context) (result *sdk.CleanupResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.dynamic_secret.cleanup_expired_leases")
	defer end(&err)

	return s.client.CleanupExpiredLeases(ctx)
}
