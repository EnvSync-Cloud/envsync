package handlers

import (
	"context"
	"errors"
	"os"

	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/usecases/environment"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/spinner"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/factory"
)

type EnvironmentHandler struct {
	getEnvUseCase    environment.GetEnvUseCase
	switchEnvUseCase environment.SwitchEnvUseCase
	deleteEnvUseCase environment.DeleteEnvUseCase
	formatter        *formatters.EnvFormatter
	tui              *factory.EnvFactory
}

func NewEnvironmentHandler(
	getEnvUseCase environment.GetEnvUseCase,
	switchEnvUseCase environment.SwitchEnvUseCase,
	deleteEnvUseCase environment.DeleteEnvUseCase,
	formatter *formatters.EnvFormatter,
	tui *factory.EnvFactory,
) *EnvironmentHandler {
	return &EnvironmentHandler{
		getEnvUseCase:    getEnvUseCase,
		switchEnvUseCase: switchEnvUseCase,
		deleteEnvUseCase: deleteEnvUseCase,
		formatter:        formatter,
		tui:              tui,
	}
}

func (h *EnvironmentHandler) SwitchEnvironment(ctx context.Context, cmd *cli.Command) error {
	if cmd.Bool("json") && !cmd.IsSet("env-id") {
		return h.formatUseCaseError(cmd, errors.New("env-id must be provided with json flag"))
	}

	env := domain.EnvType{
		ID: cmd.String("env-id"),
	}

	selected, err := h.switchEnvUseCase.Execute(ctx, env)
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, map[string]any{
			"message":     "Switched to " + selected.Name,
			"app_id":      selected.AppID,
			"env_type_id": selected.ID,
			"name":        selected.Name,
		})
	}

	return h.formatter.FormatSuccess(cmd.Writer, "Switched to "+selected.Name)
}

func (h *EnvironmentHandler) GetAllEnvironments(ctx context.Context, cmd *cli.Command) error {
	if cmd.Bool("json") && cmd.String("app-id") == "" {
		return h.formatUseCaseError(cmd, errors.New("app-id must be provided with json flag"))
	}

	sp := spinner.New("Fetching environments…", spinner.IsTerminal(os.Stderr), os.Stderr)
	if !cmd.Bool("json") {
		sp.Start()
	}
	envs, err := h.getEnvUseCase.ExecuteByAppID(ctx, cmd.String("app-id"))
	if !cmd.Bool("json") {
		sp.Stop()
	}
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, envs)
	}

	// A terminal gets the interactive table. Pipes and scripts keep the plain
	// table so existing pipelines are unaffected.
	if len(envs) > 0 && spinner.IsTerminal(cmd.Writer) {
		return h.tui.ListEnvsInteractive(envs)
	}

	return h.formatter.FormatEnvTable(cmd.Writer, envs)
}

func (h *EnvironmentHandler) DeleteEnvironment(ctx context.Context, cmd *cli.Command) error {
	if cmd.Bool("json") && !cmd.IsSet("id") {
		return h.formatUseCaseError(cmd, errors.New("id must be provided with json flag"))
	}

	if !cmd.IsSet("id") {
		return h.formatUseCaseError(cmd, errors.New("id is required for deletion"))
	}

	id := cmd.String("id")

	err := h.deleteEnvUseCase.Execute(ctx, id)
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if cmd.Bool("json") {
		jsonOutput := map[string]any{
			"message": "Environment deleted successfully",
			"id":      id,
		}

		return h.formatter.FormatJSON(cmd.Writer, jsonOutput)
	}

	if err := h.formatter.FormatSuccess(cmd.Writer, "Environment deleted successfully(id: "+id+")"); err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	return nil
}

func (h *EnvironmentHandler) formatUseCaseError(cmd *cli.Command, err error) error {
	if cmd.Bool("json") {
		jsonOutput := map[string]any{
			"error": err.Error(),
		}
		return h.formatter.FormatJSON(cmd.Writer, jsonOutput)
	}

	switch e := err.(type) {
	case *environment.EnvError:
		switch e.Code {
		case environment.EnvErrorCodeValidation:
			return h.formatter.FormatError(cmd.ErrWriter, "Validation error: "+e.Message)
		case environment.EnvErrorCodeServiceError:
			return h.formatter.FormatError(cmd.ErrWriter, "Service error: "+e.Message)
		case environment.EnvErrorCodeNotFound:
			return h.formatter.FormatError(cmd.ErrWriter, "Environment not found: "+e.Message)
		case environment.EnvErrorCodeCorrupted:
			return h.formatter.FormatError(cmd.ErrWriter, "Environment data is corrupted: "+e.Message)
		case environment.EnvErrorCodePermission:
			return h.formatter.FormatError(cmd.ErrWriter, "Permission error: "+e.Message)
		case environment.EnvErrorCodeFileSystem:
			return h.formatter.FormatError(cmd.ErrWriter, "File system error: "+e.Message)
		case environment.EnvErrorCodeTUIError:
			return h.formatter.FormatError(cmd.ErrWriter, "TUI error: "+e.Message)
		case environment.EnvErrorCodeCancelled:
			// Backing out is a choice, not a failure.
			return h.formatter.FormatWarning(cmd.ErrWriter, e.Message)
		default:
			return h.formatter.FormatError(cmd.ErrWriter, "Service error: "+e.Message)
		}
	default:
		return h.formatter.FormatError(cmd.ErrWriter, "Unexpected error: "+err.Error())
	}
}
