package handlers

import (
	"context"
	"errors"
	"fmt"

	"github.com/urfave/cli/v3"

	lf "github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/usecases/log_forwarding"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
)

type LogForwardingHandler struct {
	createUseCase lf.CreateLogForwardingConfigUseCase
	listUseCase   lf.ListLogForwardingConfigsUseCase
	getUseCase    lf.GetLogForwardingConfigUseCase
	deleteUseCase lf.DeleteLogForwardingConfigUseCase
	formatter     *formatters.LogForwardingFormatter
}

func NewLogForwardingHandler(
	createUseCase lf.CreateLogForwardingConfigUseCase,
	listUseCase lf.ListLogForwardingConfigsUseCase,
	getUseCase lf.GetLogForwardingConfigUseCase,
	deleteUseCase lf.DeleteLogForwardingConfigUseCase,
	formatter *formatters.LogForwardingFormatter,
) *LogForwardingHandler {
	return &LogForwardingHandler{
		createUseCase: createUseCase,
		listUseCase:   listUseCase,
		getUseCase:    getUseCase,
		deleteUseCase: deleteUseCase,
		formatter:     formatter,
	}
}

func (h *LogForwardingHandler) Create(ctx context.Context, cmd *cli.Command) error {
	name := cmd.String("name")
	target := cmd.String("target")
	endpointURL := cmd.String("endpoint-url")
	apiKey := cmd.String("api-key")
	enabled := cmd.Bool("enabled")

	config, err := h.createUseCase.Execute(ctx, name, target, endpointURL, apiKey, enabled)
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, config)
	}

	return h.formatter.FormatCreateSuccess(cmd.Writer, config)
}

func (h *LogForwardingHandler) List(ctx context.Context, cmd *cli.Command) error {
	configs, err := h.listUseCase.Execute(ctx)
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, configs)
	}

	if len(configs) == 0 {
		h.formatter.FormatWarning(cmd.Writer, "No log forwarding configs found.")
		return nil
	}

	return h.formatter.FormatListTable(cmd.Writer, configs)
}

func (h *LogForwardingHandler) Get(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")

	config, err := h.getUseCase.Execute(ctx, id)
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, config)
	}

	return h.formatter.FormatGetDetail(cmd.Writer, config)
}

func (h *LogForwardingHandler) Delete(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")

	resp, err := h.deleteUseCase.Execute(ctx, id)
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if cmd.Bool("json") {
		jsonData := map[string]any{
			"message": fmt.Sprintf("Log forwarding config '%s' deleted successfully", id),
		}
		if resp != nil {
			jsonData["response"] = resp
		}
		return h.formatter.FormatJSON(cmd.Writer, jsonData)
	}

	return h.formatter.FormatDeleteSuccess(cmd.Writer, id)
}

func (h *LogForwardingHandler) formatUseCaseError(cmd *cli.Command, err error) error {
	if cmd.Bool("json") {
		return h.formatter.FormatJSONError(cmd.Writer, err)
	}

	var lfErr *lf.LogForwardingError
	if errors.As(err, &lfErr) {
		switch lfErr.Code {
		case lf.ErrorCodeNotFound:
			return h.formatter.FormatError(cmd.Writer, "Config not found: "+lfErr.Message)
		case lf.ErrorCodeValidation:
			return h.formatter.FormatError(cmd.Writer, "Validation error: "+lfErr.Message)
		case lf.ErrorCodeAccessDenied:
			return h.formatter.FormatError(cmd.Writer, "Access denied: "+lfErr.Message)
		default:
			return h.formatter.FormatError(cmd.Writer, "Service error: "+lfErr.Message)
		}
	}

	return h.formatter.FormatError(cmd.Writer, "Unexpected error: "+err.Error())
}
