package services

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"
)

type SamlService interface {
	CreateProvider(ctx context.Context, input domain.CreateSamlProviderInput) (*domain.SamlProvider, error)
	ListProviders(ctx context.Context) ([]domain.SamlProvider, error)
	GetProvider(ctx context.Context, id string) (*domain.SamlProvider, error)
	UpdateProvider(ctx context.Context, input domain.UpdateSamlProviderInput) error
	DeleteProvider(ctx context.Context, id string) error
	GetMetadata(ctx context.Context, id string) error
	InitiateSso(ctx context.Context, providerID string) (*domain.SamlSsoResult, error)
}

type samlService struct{}

func NewSamlService() SamlService {
	return &samlService{}
}

func (s *samlService) CreateProvider(ctx context.Context, input domain.CreateSamlProviderInput) (*domain.SamlProvider, error) {
	client := repository.GetManagementClient()

	providerType, err := sdk.NewCreateSamlProviderRequestProviderTypeFromString(input.ProviderType)
	if err != nil {
		return nil, err
	}

	req := &sdk.CreateSamlProviderRequest{
		ProviderType: providerType,
		Name:         input.Name,
		EntityId:     input.EntityID,
		SsoUrl:       input.SsoURL,
		Certificate:  input.Certificate,
	}

	resp, err := client.SamlProviders.CreateSamlProvider(ctx, req)
	if err != nil {
		return nil, err
	}

	return mapSamlResponseToDomain(resp), nil
}

func (s *samlService) ListProviders(ctx context.Context) ([]domain.SamlProvider, error) {
	client := repository.GetManagementClient()

	resp, err := client.SamlProviders.GetAllSamlProviders(ctx)
	if err != nil {
		return nil, err
	}

	providers := make([]domain.SamlProvider, 0, len(resp))
	for _, r := range resp {
		providers = append(providers, *mapSamlResponseToDomain(r))
	}

	return providers, nil
}

func (s *samlService) GetProvider(ctx context.Context, id string) (*domain.SamlProvider, error) {
	client := repository.GetManagementClient()

	resp, err := client.SamlProviders.GetSamlProvider(ctx, id)
	if err != nil {
		return nil, err
	}

	return mapSamlResponseToDomain(resp), nil
}

func (s *samlService) UpdateProvider(ctx context.Context, input domain.UpdateSamlProviderInput) error {
	client := repository.GetManagementClient()

	req := &sdk.UpdateSamlProviderRequest{
		Name:        strPtrIfNonEmpty(input.Name),
		EntityId:    strPtrIfNonEmpty(input.EntityID),
		SsoUrl:      strPtrIfNonEmpty(input.SsoURL),
		Certificate: strPtrIfNonEmpty(input.Certificate),
		Enabled:     input.Enabled,
	}

	_, err := client.SamlProviders.UpdateSamlProvider(ctx, input.ID, req)
	return err
}

func (s *samlService) DeleteProvider(ctx context.Context, id string) error {
	client := repository.GetManagementClient()

	_, err := client.SamlProviders.DeleteSamlProvider(ctx, id)
	return err
}

func (s *samlService) GetMetadata(ctx context.Context, id string) error {
	client := repository.GetManagementClient()

	return client.SamlProviders.GetSamlMetadata(ctx, id)
}

func (s *samlService) InitiateSso(ctx context.Context, providerID string) (*domain.SamlSsoResult, error) {
	client := repository.GetManagementClient()

	req := &sdk.SamlSsoRequest{
		ProviderId: providerID,
	}

	resp, err := client.SamlSso.InitiateSamlSso(ctx, req)
	if err != nil {
		return nil, err
	}

	return &domain.SamlSsoResult{
		RedirectURL: resp.RedirectUrl,
		RequestID:   resp.RequestId,
	}, nil
}

func mapSamlResponseToDomain(r *sdk.SamlProviderResponse) *domain.SamlProvider {
	return &domain.SamlProvider{
		ID:           r.Id,
		OrgID:        r.OrgId,
		ProviderType: string(r.ProviderType),
		Name:         r.Name,
		EntityID:     r.EntityId,
		SsoURL:       r.SsoUrl,
		Certificate:  r.Certificate,
		Enabled:      r.Enabled,
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
	}
}
