package handlers

import (
	"context"
	"fmt"

	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/sync"
	"github.com/EnvSync-Cloud/envsync-cli/internal/presentation/formatters"
)

type SyncHandler struct {
	pullUseCase sync.PullUseCase
	pushUseCase sync.PushUseCase
	formatter   *formatters.SyncFormatter
}

func NewSyncHandler(
	pullUseCase sync.PullUseCase,
	pushUseCase sync.PushUseCase,
	formatter *formatters.SyncFormatter,
) *SyncHandler {
	return &SyncHandler{
		pullUseCase: pullUseCase,
		pushUseCase: pushUseCase,
		formatter:   formatter,
	}
}

func (h *SyncHandler) Pull(ctx context.Context, cmd *cli.Command) error {
	config := cmd.String("config")

	diff, err := h.pullUseCase.Execute(ctx, config)
	if err != nil {
		return err
	}

	if len(diff.Warnings) > 0 {
		// Handle warnings, e.g., print or log them
		for _, warning := range diff.Warnings {
			fmt.Printf("Warning: %s\n", warning)
		}
		return nil
	}

	if len(diff.Added) > 0 || len(diff.Updated) > 0 || len(diff.Deleted) > 0 {
		// Handle the sync response, e.g., print or log the changes
		fmt.Printf("Sync completed with %d added, %d updated, and %d deleted variables.\n",
			len(diff.Added), len(diff.Updated), len(diff.Deleted))
	} else {
		fmt.Printf("No changes detected during sync.\n")
	}

	return nil
}

func (h *SyncHandler) Push(ctx context.Context, cmd *cli.Command) error {
	config := cmd.String("config")

	diff, err := h.pushUseCase.Execute(ctx, config)
	if err != nil {
		return err
	}

	if len(diff.Warnings) > 0 {
		// Handle warnings, e.g., print or log them
		for _, warning := range diff.Warnings {
			fmt.Printf("Warning: %s\n", warning)
		}
		return nil
	}

	if len(diff.Added) > 0 || len(diff.Updated) > 0 || len(diff.Deleted) > 0 {
		// Handle the sync response, e.g., print or log the changes
		fmt.Printf("Sync completed with %d added, %d updated, and %d deleted variables.\n",
			len(diff.Added), len(diff.Updated), len(diff.Deleted))
	} else {
		fmt.Printf("No changes detected during sync.\n")
	}

	return nil
}

func (h *SyncHandler) formatUseCaseError(cmd *cli.Command, err error) error {
	if cmd.Bool("json") {
		// If JSON output is requested, format the error as JSON
		jsonOutput := map[string]any{
			"error": err.Error(),
		}
		return h.formatter.FormatJSON(cmd.Writer, jsonOutput)
	}
	// Handle different types of use case errors
	switch e := err.(type) {
	case *sync.SyncError:
		switch e.Code {
		case sync.SyncErrorCodeValidation:
			return h.formatter.FormatError(cmd.Writer, "Validation error: "+e.Message)
		case sync.SyncErrorCodeFileSystem:
			return h.formatter.FormatError(cmd.Writer, "File system error: "+e.Message)
		case sync.SyncErrorCodePermission:
			return h.formatter.FormatError(cmd.Writer, "Permission error: "+e.Message)
		case sync.SyncErrorCodeNotFound:
			return h.formatter.FormatError(cmd.Writer, "Not found error: "+e.Message)
		case sync.SyncErrorCodeCorrupted:
			return h.formatter.FormatError(cmd.Writer, "Corrupted file error: "+e.Message)
		case sync.SyncErrorCodeServiceError:
			return h.formatter.FormatError(cmd.Writer, "Service error: "+e.Message)
		default:
			return h.formatter.FormatError(cmd.Writer, "Service error: "+e.Message)
		}
	default:
		return h.formatter.FormatError(cmd.Writer, "Unexpected error: "+err.Error())
	}
}
