package handlers

import (
	"context"
	"errors"

	"github.com/urfave/cli/v3"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/usecases/service_token"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
)

type ServiceTokenHandler struct {
	createUseCase service_token.CreateServiceTokenUseCase
	listUseCase   service_token.ListServiceTokensUseCase
	getUseCase    service_token.GetServiceTokenUseCase
	deleteUseCase service_token.DeleteServiceTokenUseCase
	formatter     *formatters.ServiceTokenFormatter
}

func NewServiceTokenHandler(
	createUseCase service_token.CreateServiceTokenUseCase,
	listUseCase service_token.ListServiceTokensUseCase,
	getUseCase service_token.GetServiceTokenUseCase,
	deleteUseCase service_token.DeleteServiceTokenUseCase,
	formatter *formatters.ServiceTokenFormatter,
) *ServiceTokenHandler {
	return &ServiceTokenHandler{
		createUseCase: createUseCase,
		listUseCase:   listUseCase,
		getUseCase:    getUseCase,
		deleteUseCase: deleteUseCase,
		formatter:     formatter,
	}
}

func (h *ServiceTokenHandler) Create(ctx context.Context, cmd *cli.Command) error {
	req := &sdk.CreateServiceTokenRequest{}

	if cmd.IsSet("name") {
		req.Name = cmd.String("name")
	}
	if cmd.IsSet("app-id") {
		appID := cmd.String("app-id")
		req.AppId = &appID
	}
	if cmd.IsSet("env-type-id") {
		envTypeID := cmd.String("env-type-id")
		req.EnvTypeId = &envTypeID
	}
	if cmd.IsSet("expires-in-days") {
		days := int(cmd.Int("expires-in-days"))
		req.ExpiresInDays = &days
	}

	if cmd.IsSet("read") || cmd.IsSet("write") {
		permissions := &sdk.ServiceTokenPermissions{}
		if cmd.IsSet("read") {
			read := cmd.Bool("read")
			permissions.Read = read
		}
		if cmd.IsSet("write") {
			write := cmd.Bool("write")
			permissions.Write = write
		}
		req.Permissions = permissions
	}

	token, err := h.createUseCase.Execute(ctx, req)
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, token)
	}

	return h.formatter.FormatCreateSuccessMessage(cmd.Writer, token)
}

func (h *ServiceTokenHandler) List(ctx context.Context, cmd *cli.Command) error {
	tokens, err := h.listUseCase.Execute(ctx)
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, tokens)
	}

	return h.formatter.FormatListTable(cmd.Writer, tokens)
}

func (h *ServiceTokenHandler) Get(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")

	token, err := h.getUseCase.Execute(ctx, id)
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, token)
	}

	return h.formatter.FormatGetSuccessMessage(cmd.Writer, token)
}

func (h *ServiceTokenHandler) Delete(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")

	if err := h.deleteUseCase.Execute(ctx, id); err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if cmd.Bool("json") {
		jsonData := map[string]any{
			"message": "Service token deleted successfully",
			"id":      id,
		}
		return h.formatter.FormatJSON(cmd.Writer, jsonData)
	}

	return h.formatter.FormatDeleteSuccessMessage(cmd.Writer, id)
}

func (h *ServiceTokenHandler) formatUseCaseError(cmd *cli.Command, err error) error {
	if cmd.Bool("json") {
		return h.formatter.FormatJSONError(cmd.Writer, err)
	}

	var stErr *service_token.ServiceTokenError
	if errors.As(err, &stErr) {
		switch stErr.Code {
		case service_token.ServiceTokenErrorCodeValidation:
			return h.formatter.FormatError(cmd.Writer, "Validation error: "+stErr.Message)
		case service_token.ServiceTokenErrorCodeNotFound:
			return h.formatter.FormatError(cmd.Writer, "Service token not found: "+stErr.Message)
		case service_token.ServiceTokenErrorCodeAccessDenied:
			return h.formatter.FormatError(cmd.Writer, "Access denied: "+stErr.Message)
		default:
			return h.formatter.FormatError(cmd.Writer, "Service error: "+stErr.Message)
		}
	}

	return h.formatter.FormatError(cmd.Writer, "Unexpected error: "+err.Error())
}
