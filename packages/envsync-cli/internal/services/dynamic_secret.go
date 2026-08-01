package services

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	"github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/dynamicsecrets"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
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

func (s *dynamicSecretService) ListEngines(ctx context.Context) (sdk.DynamicSecretEnginesResponse, error) {
	return s.client.GetAllDynamicSecretEngines(ctx)
}

func (s *dynamicSecretService) CreateEngine(ctx context.Context, req *sdk.CreateDynamicSecretEngineRequest) (*sdk.DynamicSecretEngineResponse, error) {
	return s.client.CreateDynamicSecretEngine(ctx, req)
}

func (s *dynamicSecretService) GetEngine(ctx context.Context, id string) (*sdk.DynamicSecretEngineResponse, error) {
	return s.client.GetDynamicSecretEngine(ctx, id)
}

func (s *dynamicSecretService) DeleteEngine(ctx context.Context, id string) (*sdk.ErrorResponse, error) {
	return s.client.DeleteDynamicSecretEngine(ctx, id)
}

func (s *dynamicSecretService) UpdateEngine(ctx context.Context, id string, req *sdk.UpdateDynamicSecretEngineRequest) (*sdk.DynamicSecretEngineResponse, error) {
	return s.client.UpdateDynamicSecretEngine(ctx, id, req)
}

func (s *dynamicSecretService) ListLeases(ctx context.Context, engineID string) (sdk.DynamicSecretLeasesResponse, error) {
	return s.client.GetDynamicSecretLeases(ctx, engineID)
}

func (s *dynamicSecretService) CreateLease(ctx context.Context, engineID string, req *sdk.CreateDynamicSecretLeaseRequest) (*sdk.DynamicSecretLeaseResponse, error) {
	return s.client.CreateDynamicSecretLease(ctx, engineID, req)
}

func (s *dynamicSecretService) GetLease(ctx context.Context, leaseID string) (*sdk.DynamicSecretLeaseResponse, error) {
	return s.client.GetDynamicSecretLease(ctx, leaseID)
}

func (s *dynamicSecretService) RevokeLease(ctx context.Context, leaseID string) (*sdk.RevokeLeaseResponse, error) {
	return s.client.RevokeDynamicSecretLease(ctx, leaseID)
}

func (s *dynamicSecretService) CleanupExpiredLeases(ctx context.Context) (*sdk.CleanupResponse, error) {
	return s.client.CleanupExpiredLeases(ctx)
}
