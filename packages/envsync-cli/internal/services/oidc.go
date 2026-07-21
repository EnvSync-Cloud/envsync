package services

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"
)

type OidcService interface {
	CreateProvider(ctx context.Context, input domain.CreateOidcProviderInput) (*domain.OidcProvider, error)
	ListProviders(ctx context.Context) ([]domain.OidcProvider, error)
	GetProvider(ctx context.Context, id string) (*domain.OidcProvider, error)
	UpdateProvider(ctx context.Context, input domain.UpdateOidcProviderInput) error
	DeleteProvider(ctx context.Context, id string) error
}

type oidcService struct{}

func NewOidcService() OidcService {
	return &oidcService{}
}

func (s *oidcService) CreateProvider(ctx context.Context, input domain.CreateOidcProviderInput) (*domain.OidcProvider, error) {
	client := repository.GetManagementClient()

	providerType, err := sdk.NewCreateOidcProviderRequestProviderTypeFromString(input.ProviderType)
	if err != nil {
		return nil, err
	}

	req := &sdk.CreateOidcProviderRequest{
		ProviderType:    providerType,
		IssuerUrl:       input.IssuerURL,
		Audience:        input.Audience,
		AllowedSubjects: input.AllowedSubjects,
	}

	resp, err := client.OidcProviders.CreateOidcProvider(ctx, req)
	if err != nil {
		return nil, err
	}

	return mapOidcResponseToDomain(resp), nil
}

func (s *oidcService) ListProviders(ctx context.Context) ([]domain.OidcProvider, error) {
	client := repository.GetManagementClient()

	resp, err := client.OidcProviders.GetAllOidcProviders(ctx)
	if err != nil {
		return nil, err
	}

	providers := make([]domain.OidcProvider, 0, len(resp))
	for _, r := range resp {
		providers = append(providers, *mapOidcResponseToDomain(r))
	}

	return providers, nil
}

func (s *oidcService) GetProvider(ctx context.Context, id string) (*domain.OidcProvider, error) {
	client := repository.GetManagementClient()

	resp, err := client.OidcProviders.GetOidcProvider(ctx, id)
	if err != nil {
		return nil, err
	}

	return mapOidcResponseToDomain(resp), nil
}

func (s *oidcService) UpdateProvider(ctx context.Context, input domain.UpdateOidcProviderInput) error {
	client := repository.GetManagementClient()

	req := &sdk.UpdateOidcProviderRequest{
		Audience:        strPtrIfNonEmpty(input.Audience),
		Enabled:         input.Enabled,
		AllowedSubjects: input.AllowedSubjects,
	}

	_, err := client.OidcProviders.UpdateOidcProvider(ctx, input.ID, req)
	return err
}

func (s *oidcService) DeleteProvider(ctx context.Context, id string) error {
	client := repository.GetManagementClient()

	_, err := client.OidcProviders.DeleteOidcProvider(ctx, id)
	return err
}

func mapOidcResponseToDomain(r *sdk.OidcProviderResponse) *domain.OidcProvider {
	var machineUserID string
	if r.MachineUserId != nil {
		machineUserID = *r.MachineUserId
	}
	return &domain.OidcProvider{
		ID:              r.Id,
		OrgID:           r.OrgId,
		ProviderType:    string(r.ProviderType),
		IssuerURL:       r.IssuerUrl,
		Audience:        r.Audience,
		Enabled:         r.Enabled,
		AllowedSubjects: r.AllowedSubjects,
		MachineUserID:   machineUserID,
		CreatedAt:       r.CreatedAt,
		UpdatedAt:       r.UpdatedAt,
	}
}

func strPtrIfNonEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
