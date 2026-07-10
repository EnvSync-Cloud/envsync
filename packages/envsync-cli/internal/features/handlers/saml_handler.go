package handlers

import (
	"context"

	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/usecases/saml"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
)

type SamlHandler struct {
	createUseCase   saml.CreateSamlProviderUseCase
	listUseCase     saml.ListSamlProvidersUseCase
	getUseCase      saml.GetSamlProviderUseCase
	updateUseCase   saml.UpdateSamlProviderUseCase
	deleteUseCase   saml.DeleteSamlProviderUseCase
	metadataUseCase saml.GetSamlMetadataUseCase
	ssoUseCase      saml.InitiateSamlSsoUseCase
	formatter       *formatters.SamlFormatter
}

func NewSamlHandler(
	createUseCase saml.CreateSamlProviderUseCase,
	listUseCase saml.ListSamlProvidersUseCase,
	getUseCase saml.GetSamlProviderUseCase,
	updateUseCase saml.UpdateSamlProviderUseCase,
	deleteUseCase saml.DeleteSamlProviderUseCase,
	metadataUseCase saml.GetSamlMetadataUseCase,
	ssoUseCase saml.InitiateSamlSsoUseCase,
	formatter *formatters.SamlFormatter,
) *SamlHandler {
	return &SamlHandler{
		createUseCase:   createUseCase,
		listUseCase:     listUseCase,
		getUseCase:      getUseCase,
		updateUseCase:   updateUseCase,
		deleteUseCase:   deleteUseCase,
		metadataUseCase: metadataUseCase,
		ssoUseCase:      ssoUseCase,
		formatter:       formatter,
	}
}

func (h *SamlHandler) Create(ctx context.Context, cmd *cli.Command) error {
	input := domain.CreateSamlProviderInput{
		ProviderType: cmd.String("provider-type"),
		Name:         cmd.String("name"),
		EntityID:     cmd.String("entity-id"),
		SsoURL:       cmd.String("sso-url"),
		Certificate:  cmd.String("certificate"),
	}

	provider, err := h.createUseCase.Execute(ctx, input)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, provider)
	}

	return h.formatter.FormatCreateSuccess(cmd.Writer, *provider)
}

func (h *SamlHandler) List(ctx context.Context, cmd *cli.Command) error {
	providers, err := h.listUseCase.Execute(ctx)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, providers)
	}

	return h.formatter.FormatList(cmd.Writer, providers)
}

func (h *SamlHandler) Get(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")

	provider, err := h.getUseCase.Execute(ctx, id)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, provider)
	}

	return h.formatter.FormatDetail(cmd.Writer, *provider)
}

func (h *SamlHandler) Update(ctx context.Context, cmd *cli.Command) error {
	input := domain.UpdateSamlProviderInput{
		ID: cmd.String("id"),
	}

	if cmd.IsSet("name") {
		input.Name = cmd.String("name")
	}
	if cmd.IsSet("entity-id") {
		input.EntityID = cmd.String("entity-id")
	}
	if cmd.IsSet("sso-url") {
		input.SsoURL = cmd.String("sso-url")
	}
	if cmd.IsSet("certificate") {
		input.Certificate = cmd.String("certificate")
	}
	if cmd.IsSet("enabled") {
		enabled := cmd.Bool("enabled")
		input.Enabled = &enabled
	}

	if err := h.updateUseCase.Execute(ctx, input); err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, map[string]string{"message": "SAML provider updated successfully"})
	}

	return h.formatter.FormatSuccess(cmd.Writer, "SAML provider updated successfully")
}

func (h *SamlHandler) Delete(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")

	if err := h.deleteUseCase.Execute(ctx, id); err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, map[string]string{"message": "SAML provider deleted successfully"})
	}

	return h.formatter.FormatDeleteSuccess(cmd.Writer, id)
}

func (h *SamlHandler) Metadata(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")

	if err := h.metadataUseCase.Execute(ctx, id); err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, map[string]string{"message": "SAML metadata retrieved successfully"})
	}

	return h.formatter.FormatMetadataSuccess(cmd.Writer, id)
}

func (h *SamlHandler) Sso(ctx context.Context, cmd *cli.Command) error {
	providerID := cmd.String("provider-id")

	result, err := h.ssoUseCase.Execute(ctx, providerID)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, result)
	}

	return h.formatter.FormatSsoResult(cmd.Writer, *result)
}

func (h *SamlHandler) formatError(cmd *cli.Command, err error) error {
	if cmd.Bool("json") {
		return h.formatter.FormatJSONError(cmd.Writer, err)
	}
	return h.formatter.FormatError(cmd.Writer, err.Error())
}
