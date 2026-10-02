package handlers

import (
	"context"

	inituc "github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/usecases/init"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
	"github.com/urfave/cli/v3"
)

type InitHandler struct {
	initUseCase inituc.InitUseCase
	formatter   *formatters.InitFormatter
}

func NewInitHandler(initUseCase inituc.InitUseCase, formatter *formatters.InitFormatter) *InitHandler {
	return &InitHandler{
		initUseCase: initUseCase,
		formatter:   formatter,
	}
}

func (h *InitHandler) Init(ctx context.Context, cmd *cli.Command) error {
	appID := cmd.String("app-id")
	envTypeID := cmd.String("env-type-id")

	if err := h.initUseCase.ExecuteWithOptions(ctx, cmd.String("config"), appID, envTypeID); err != nil {
		return h.formatUseCaseError(cmd, err)
	}
	return nil
}

func (h *InitHandler) formatUseCaseError(cmd *cli.Command, err error) error {
	if cmd.Bool("json") {
		jsonOutput := map[string]any{
			"error": err.Error(),
		}
		return h.formatter.FormatJSON(cmd.Writer, jsonOutput)
	}

	switch e := err.(type) {
	case *inituc.InitError:
		switch e.Code {
		case inituc.InitErrorCodeValidation:
			return h.formatter.FormatError(cmd.ErrWriter, "Validation error: "+e.Message)
		case inituc.InitErrorCodeFileSystem:
			return h.formatter.FormatError(cmd.ErrWriter, "File system error: "+e.Message)
		case inituc.InitErrorCodePermission:
			return h.formatter.FormatError(cmd.ErrWriter, "Permission error: "+e.Message)
		case inituc.InitErrorCodeAlreadyExists:
			return h.formatter.FormatError(cmd.ErrWriter, "Configuration already exists: "+e.Message)
		case inituc.InitErrorCodeNotFound:
			return h.formatter.FormatError(cmd.ErrWriter, "Not found error: "+e.Message)
		case inituc.InitErrorCodeServiceError:
			return h.formatter.FormatError(cmd.ErrWriter, "Service error: "+e.Message)
		case inituc.InitErrorCodeNetworkError:
			return h.formatter.FormatError(cmd.ErrWriter, "Network error: "+e.Message)
		case inituc.InitErrorCodeTUIError:
			return h.formatter.FormatError(cmd.ErrWriter, "TUI error: "+e.Message)
		case inituc.InitErrorCodeCancelled:
			return h.formatter.FormatError(cmd.ErrWriter, "Operation cancelled: "+e.Message)
		case inituc.InitErrorCodeTimeout:
			return h.formatter.FormatError(cmd.ErrWriter, "Operation timed out: "+e.Message)
		default:
			return h.formatter.FormatError(cmd.ErrWriter, "Service error: "+e.Message)
		}
	default:
		return h.formatter.FormatError(cmd.ErrWriter, "Unexpected error: "+err.Error())
	}
}
