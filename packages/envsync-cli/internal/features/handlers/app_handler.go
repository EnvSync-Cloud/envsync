package handlers

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/usecases/app"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/spinner"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/factory"
)

type AppHandler struct {
	createUseCase app.CreateAppUseCase
	deleteUseCase app.DeleteAppUseCase
	listUseCase   app.ListAppsUseCase
	formatter     *formatters.AppFormatter
	tui           *factory.AppFactory
}

func NewAppHandler(
	createUseCase app.CreateAppUseCase,
	deleteUseCase app.DeleteAppUseCase,
	listUseCase app.ListAppsUseCase,
	formatter *formatters.AppFormatter,
	tui *factory.AppFactory,
) *AppHandler {
	return &AppHandler{
		createUseCase: createUseCase,
		deleteUseCase: deleteUseCase,
		listUseCase:   listUseCase,
		formatter:     formatter,
		tui:           tui,
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

	metadata, err := domain.ParseMetadata(cmd.StringSlice("metadata"))
	if err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, "Invalid metadata: "+err.Error())
	}
	application.Metadata = metadata

	enableSecret := cmd.Bool("enable-secret")
	publicKey := cmd.String("public-key")

	application.EnableSecrets = enableSecret
	application.PublicKey = publicKey
	application.IsManagedSecret = enableSecret && publicKey == ""

	if cmd.Bool("default-types") {
		application.EnvTypes = append(application.EnvTypes, domain.DefaultEnvTypes...)
	}

	createdApp, err := h.createUseCase.Execute(ctx, application)
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	// A key is only used when secrets are enabled, so say so rather than
	// dropping it without a word.
	if publicKey != "" && !enableSecret {
		h.warn(cmd, "--public-key was ignored because --enable-secret is not set")
	}
	if application.IsManagedSecret {
		h.warn(cmd, "secrets are enabled but no public key was provided. A self managed key will be generated!!!")
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, createdApp)
	}

	return h.formatter.FormatCreateSuccessMessage(cmd.Writer, *createdApp)
}

// warn reports a non-fatal problem. Under --json it goes to stderr so stdout
// stays a single parseable document. A failed warning must not fail the
// command, so the write error is deliberately dropped.
func (h *AppHandler) warn(cmd *cli.Command, message string) {
	out := cmd.Writer
	if cmd.Bool("json") {
		out = cmd.ErrWriter
	}
	_ = h.formatter.FormatWarning(out, message)
}

func (h *AppHandler) Delete(ctx context.Context, cmd *cli.Command) error {
	if cmd.IsSet("json") && (!cmd.IsSet("id") && !cmd.IsSet("name")) {
		return h.formatter.FormatJSONError(cmd.Writer, errors.New("Application ID or Name is required for deletion."))
	}

	jsonOutput := cmd.Bool("json")

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
	// Show progress while the apps load, then hand the screen over to the view.
	sp := spinner.New("Fetching applications…", spinner.IsTerminal(os.Stderr), os.Stderr)
	if !cmd.Bool("json") {
		sp.Start()
	}
	apps, err := h.listUseCase.Execute(ctx)
	if !cmd.Bool("json") {
		sp.Stop()
	}
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, apps)
	}

	// A terminal gets the interactive list. Pipes and scripts keep the plain
	// table so existing pipelines are unaffected.
	if len(apps) > 0 && spinner.IsTerminal(cmd.Writer) {
		return h.tui.ListAppsInteractive(apps)
	}

	return h.formatter.FormatListTable(cmd.Writer, apps)
}

func (h *AppHandler) formatUseCaseError(cmd *cli.Command, err error) error {
	if cmd.Bool("json") {
		return h.formatter.FormatJSONError(cmd.Writer, err)
	}

	switch e := err.(type) {
	case *app.AppError:
		switch e.Code {
		case app.AppErrorCodeNotFound:
			return h.formatter.FormatError(cmd.ErrWriter, "Application not found: "+e.Message)
		case app.AppErrorCodeAlreadyExists:
			return h.formatter.FormatError(cmd.ErrWriter, "Application already exists: "+e.Message)
		case app.AppErrorCodeValidation:
			return h.formatter.FormatError(cmd.ErrWriter, "Validation error: "+e.Message)
		case app.AppErrorCodeAccessDenied:
			return h.formatter.FormatError(cmd.ErrWriter, "Access denied: "+e.Message)
		case app.AppErrorCodeInUse:
			return h.formatter.FormatWarning(cmd.Writer, "Cannot complete operation: "+e.Message)
		case app.AppErrorCodeCancelled:
			return h.formatter.FormatWarning(cmd.Writer, "Operation cancelled: "+e.Message)
		case app.AppErrorTUI:
			return h.formatter.FormatError(cmd.ErrWriter, "TUI error: "+e.Message)
		default:
			return h.formatter.FormatError(cmd.ErrWriter, "Service error: "+e.Message)
		}
	default:
		return h.formatter.FormatError(cmd.ErrWriter, "Unexpected error: "+err.Error())
	}
}
