package handlers

import (
	"context"
	"errors"

	inituc "github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/init"
	"github.com/EnvSync-Cloud/envsync-cli/internal/presentation/formatters"
	tea "github.com/charmbracelet/bubbletea"
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
	if err := h.initUseCase.Execute(ctx, cmd.String("config")); !errors.Is(err, tea.ErrProgramKilled) && err != nil {
		return h.formatUseCaseError(cmd, err)
	}
	return nil
}

func (h *InitHandler) formatUseCaseError(cmd *cli.Command, err error) error {
	if cmd.Bool("json") {
		// If JSON output is requested, format the error as JSON
		jsonOutput := map[string]any{
			"error": err.Error(),
		}
		return h.formatter.FormatJSON(cmd.Writer, jsonOutput)
	}

	// Handle different types of use case errors
	switch e := err.(type) {
	case *inituc.InitError:
		switch e.Code {
		case inituc.InitErrorCodeValidation:
			return h.formatter.FormatError(cmd.Writer, "Validation error: "+e.Message)
		case inituc.InitErrorCodeFileSystem:
			return h.formatter.FormatError(cmd.Writer, "File system error: "+e.Message)
		case inituc.InitErrorCodePermission:
			return h.formatter.FormatError(cmd.Writer, "Permission error: "+e.Message)
		case inituc.InitErrorCodeAlreadyExists:
			return h.formatter.FormatError(cmd.Writer, "Configuration already exists: "+e.Message)
		case inituc.InitErrorCodeNotFound:
			return h.formatter.FormatError(cmd.Writer, "Not found error: "+e.Message)
		case inituc.InitErrorCodeServiceError:
			return h.formatter.FormatError(cmd.Writer, "Service error: "+e.Message)
		case inituc.InitErrorCodeNetworkError:
			return h.formatter.FormatError(cmd.Writer, "Network error: "+e.Message)
		case inituc.InitErrorCodeTUIError:
			return h.formatter.FormatError(cmd.Writer, "TUI error: "+e.Message)
		case inituc.InitErrorCodeCancelled:
			return h.formatter.FormatError(cmd.Writer, "Operation cancelled: "+e.Message)
		case inituc.InitErrorCodeTimeout:
			return h.formatter.FormatError(cmd.Writer, "Operation timed out: "+e.Message)
		default:
			return h.formatter.FormatError(cmd.Writer, "Service error: "+e.Message)
		}
	default:
		return h.formatter.FormatError(cmd.Writer, "Unexpected error: "+err.Error())
	}
}
