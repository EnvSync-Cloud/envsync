package handlers

import (
	"context"
	"errors"
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/app"
	"github.com/EnvSync-Cloud/envsync-cli/internal/presentation/formatters"
)

type AppHandler struct {
	createUseCase app.CreateAppUseCase
	deleteUseCase app.DeleteAppUseCase
	listUseCase   app.ListAppsUseCase
	formatter     *formatters.AppFormatter
}

func NewAppHandler(
	createUseCase app.CreateAppUseCase,
	deleteUseCase app.DeleteAppUseCase,
	listUseCase app.ListAppsUseCase,
	formatter *formatters.AppFormatter,
) *AppHandler {
	return &AppHandler{
		createUseCase: createUseCase,
		deleteUseCase: deleteUseCase,
		listUseCase:   listUseCase,
		formatter:     formatter,
	}
}

func (h *AppHandler) Create(ctx context.Context, cmd *cli.Command) error {
	var application domain.Application
	if cmd.IsSet("name") {
		application.Name = cmd.String("name")
	}
	if cmd.IsSet("description") {
		application.Description = cmd.String("description")
	}
	if cmd.IsSet("metadata") {
		metadata := cmd.String("metadata")
		if metadata != "" {
			// Parse metadata JSON string into a map
			// Assuming metadata is in format key-value pairs like "key1=value1,key2=value2"
			metadataMap := make(map[string]any)
			// pairs := utils.ParseKeyValuePairs(metadata)
			// for _, pair := range pairs {
			// 	parts := utils.SplitKeyValue(pair)
			// 	if len(parts) == 2 {
			// 		metadataMap[parts[0]] = parts[1]
			// 	} else {
			// 		return h.formatter.FormatError(cmd.Writer, "Invalid metadata format. Use key=value pairs.")
			// 	}
			// }
			application.Metadata = metadataMap
		}
	}

	// Extract values from command flags
	setDefaultEnv := cmd.Bool("default-types")
	enableSecret := cmd.Bool("enable-secret")
	publicKey := cmd.String("public-key")

	application.EnableSecrets = enableSecret
	application.PublicKey = publicKey

	if publicKey == "" && enableSecret {
		application.IsManagedSecret = true
	} else {
		application.IsManagedSecret = false
	}

	// Set values in context
	ctx = context.WithValue(ctx, "setDefaultEnv", setDefaultEnv)

	app, err := h.createUseCase.Execute(ctx, application)
	if err != nil {
		if !errors.Is(err, tea.ErrProgramKilled) {
			return h.formatUseCaseError(cmd, err)
		}
	}

	if cmd.Bool("json") {
		if application.EnableSecrets && app.PublicKey == "" {
			return h.formatter.FormatWarningJSON(cmd.Writer, "secrets are enabled but no public key was provided. A self managed key will be generated!!!")
		}

		// If JSON output is requested, format the application as JSON
		return h.formatter.FormatJSON(cmd.Writer, app)
	}

	if application.EnableSecrets && application.PublicKey == "" {
		h.formatter.FormatWarning(cmd.Writer, "Secrets are enabled but no public key was provided. A self managed key will be generated!!!")
	}

	// Display success message
	return h.formatter.FormatCreateSuccessMessage(cmd.Writer, *app)
}

func (h *AppHandler) Delete(ctx context.Context, cmd *cli.Command) error {
	if cmd.IsSet("json") && (!cmd.IsSet("id") && !cmd.IsSet("name")) {
		return h.formatter.FormatJSONError(cmd.Writer, errors.New("Application ID or Name is required for deletion."))
	}

	jsonOutput := cmd.Bool("json")

	// Set both appID, appName and json to context
	ctx = context.WithValue(ctx, "appID", cmd.String("id"))
	ctx = context.WithValue(ctx, "appName", cmd.String("name"))

	deletedApps, err := h.deleteUseCase.Execute(ctx)
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if jsonOutput {
		jsonData := map[string]any{
			"message":      "Applications deleted successfully",
			"deleted_apps": deletedApps,
		}
		return h.formatter.FormatJSON(cmd.Writer, jsonData)
	}

	if len(deletedApps) > 0 {
		successMsg := "Successfully deleted applications:\n"
		for i, app := range deletedApps {
			successMsg += fmt.Sprintf("%d) %s (ID: %s)\n", i+1, app.Name, app.ID)
		}
		h.formatter.FormatSuccess(cmd.Writer, successMsg)
	} else {
		h.formatter.FormatWarning(cmd.Writer, "No application was selected.")
	}

	return nil
}

func (h *AppHandler) List(ctx context.Context, cmd *cli.Command) error {
	ctx = context.WithValue(ctx, "json", cmd.Bool("json"))

	apps, err := h.listUseCase.Execute(ctx)
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, apps)
	}

	return nil
}

// Helper methods

func (h *AppHandler) formatUseCaseError(cmd *cli.Command, err error) error {
	// If JSON output is requested, use FormatJSONError
	if cmd.Bool("json") {
		return h.formatter.FormatJSONError(cmd.Writer, err)
	}

	// Handle different types of use case errors
	switch e := err.(type) {
	case *app.AppError:
		switch e.Code {
		case app.AppErrorCodeNotFound:
			return h.formatter.FormatError(cmd.Writer, "Application not found: "+e.Message)
		case app.AppErrorCodeAlreadyExists:
			return h.formatter.FormatError(cmd.Writer, "Application already exists: "+e.Message)
		case app.AppErrorCodeValidation:
			return h.formatter.FormatError(cmd.Writer, "Validation error: "+e.Message)
		case app.AppErrorCodeAccessDenied:
			return h.formatter.FormatError(cmd.Writer, "Access denied: "+e.Message)
		case app.AppErrorCodeInUse:
			return h.formatter.FormatWarning(cmd.Writer, "Cannot complete operation: "+e.Message)
		case app.AppErrorTUI:
			return h.formatter.FormatError(cmd.Writer, "TUI error: "+e.Message)
		default:
			return h.formatter.FormatError(cmd.Writer, "Service error: "+e.Message)
		}
	default:
		return h.formatter.FormatError(cmd.Writer, "Unexpected error: "+err.Error())
	}
}
