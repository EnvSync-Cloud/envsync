package handlers

import (
	"context"
	"strings"

	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/usecases/oidc"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
)

type OidcHandler struct {
	createUseCase oidc.CreateOidcProviderUseCase
	listUseCase   oidc.ListOidcProvidersUseCase
	getUseCase    oidc.GetOidcProviderUseCase
	updateUseCase oidc.UpdateOidcProviderUseCase
	deleteUseCase oidc.DeleteOidcProviderUseCase
	formatter     *formatters.OidcFormatter
}

func NewOidcHandler(
	createUseCase oidc.CreateOidcProviderUseCase,
	listUseCase oidc.ListOidcProvidersUseCase,
	getUseCase oidc.GetOidcProviderUseCase,
	updateUseCase oidc.UpdateOidcProviderUseCase,
	deleteUseCase oidc.DeleteOidcProviderUseCase,
	formatter *formatters.OidcFormatter,
) *OidcHandler {
	return &OidcHandler{
		createUseCase: createUseCase,
		listUseCase:   listUseCase,
		getUseCase:    getUseCase,
		updateUseCase: updateUseCase,
		deleteUseCase: deleteUseCase,
		formatter:     formatter,
	}
}

func (h *OidcHandler) Create(ctx context.Context, cmd *cli.Command) error {
	input := domain.CreateOidcProviderInput{
		ProviderType: cmd.String("name"),
		IssuerURL:    cmd.String("issuer-url"),
		Audience:     cmd.String("audience"),
	}

	if cmd.IsSet("allowed-subjects") {
		input.AllowedSubjects = parseCommaSeparated(cmd.String("allowed-subjects"))
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

func (h *OidcHandler) List(ctx context.Context, cmd *cli.Command) error {
	providers, err := h.listUseCase.Execute(ctx)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, providers)
	}

	return h.formatter.FormatList(cmd.Writer, providers)
}

func (h *OidcHandler) Get(ctx context.Context, cmd *cli.Command) error {
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

func (h *OidcHandler) Update(ctx context.Context, cmd *cli.Command) error {
	input := domain.UpdateOidcProviderInput{
		ID: cmd.String("id"),
	}

	if cmd.IsSet("audience") {
		input.Audience = cmd.String("audience")
	}
	if cmd.IsSet("enabled") {
		enabled := cmd.Bool("enabled")
		input.Enabled = &enabled
	}
	if cmd.IsSet("allowed-subjects") {
		input.AllowedSubjects = parseCommaSeparated(cmd.String("allowed-subjects"))
	}

	if err := h.updateUseCase.Execute(ctx, input); err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, map[string]string{"message": "OIDC provider updated successfully"})
	}

	return h.formatter.FormatSuccess(cmd.Writer, "OIDC provider updated successfully")
}

func (h *OidcHandler) Delete(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")

	if err := h.deleteUseCase.Execute(ctx, id); err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, map[string]string{"message": "OIDC provider deleted successfully"})
	}

	return h.formatter.FormatDeleteSuccess(cmd.Writer, id)
}

func (h *OidcHandler) formatError(cmd *cli.Command, err error) error {
	if cmd.Bool("json") {
		return h.formatter.FormatJSONError(cmd.Writer, err)
	}
	return h.formatter.FormatError(cmd.Writer, err.Error())
}

func parseCommaSeparated(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
