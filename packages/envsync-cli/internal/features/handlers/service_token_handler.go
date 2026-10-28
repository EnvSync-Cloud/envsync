package handlers

import (
	"context"
	"errors"
	"os"

	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/usecases/app"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/usecases/environment"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/usecases/service_token"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/spinner"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/factory"
)

type ServiceTokenHandler struct {
	createUseCase service_token.CreateServiceTokenUseCase
	listUseCase   service_token.ListServiceTokensUseCase
	getUseCase    service_token.GetServiceTokenUseCase
	deleteUseCase service_token.DeleteServiceTokenUseCase
	listApps      app.ListAppsUseCase
	getEnvs       environment.GetEnvUseCase
	formatter     *formatters.ServiceTokenFormatter
	tui           *factory.ServiceTokenFactory
}

func NewServiceTokenHandler(
	createUseCase service_token.CreateServiceTokenUseCase,
	listUseCase service_token.ListServiceTokensUseCase,
	getUseCase service_token.GetServiceTokenUseCase,
	deleteUseCase service_token.DeleteServiceTokenUseCase,
	listApps app.ListAppsUseCase,
	getEnvs environment.GetEnvUseCase,
	formatter *formatters.ServiceTokenFormatter,
	tui *factory.ServiceTokenFactory,
) *ServiceTokenHandler {
	return &ServiceTokenHandler{
		createUseCase: createUseCase,
		listUseCase:   listUseCase,
		getUseCase:    getUseCase,
		deleteUseCase: deleteUseCase,
		listApps:      listApps,
		getEnvs:       getEnvs,
		formatter:     formatter,
		tui:           tui,
	}
}

func (h *ServiceTokenHandler) Create(ctx context.Context, cmd *cli.Command) error {
	jsonOutput := cmd.Bool("json")

	name := cmd.String("name")
	appID := cmd.String("app-id")
	envTypeID := cmd.String("env-type-id")
	read := cmd.Bool("read")
	write := cmd.Bool("write")

	// Permissions stay nil while the user states none: the API then applies
	// its default (read-only). Once a flag is set or the form answers, the
	// explicit values are sent — that is what keeps form "no/no" a real no.
	var permissions *domain.ServiceTokenPermissions
	if cmd.IsSet("read") || cmd.IsSet("write") {
		permissions = &domain.ServiceTokenPermissions{Read: read, Write: write}
	}

	expiresInDays := 0
	if cmd.IsSet("expires-in-days") {
		expiresInDays = int(cmd.Int("expires-in-days"))
	}

	// Flags alone can carry a run when they cover the key and the scope. The
	// pickers and form collect what is missing. JSON output is for scripts: it
	// takes flag values only and never opens the TUI.
	switch {
	case jsonOutput:
		if name == "" {
			return h.formatUseCaseError(cmd, service_token.NewServiceTokenValidationError("name must be provided with json flag", service_token.ErrTokenNameRequired))
		}
	case name == "" || appID == "" || envTypeID == "":
		if !spinner.IsTerminal(os.Stdin) {
			return h.formatUseCaseError(cmd, service_token.NewServiceTokenValidationError("name, app-id and env-type-id are required; provide --name, --app-id and --env-type-id flags", service_token.ErrTokenNameRequired))
		}

		if appID == "" {
			apps, err := h.fetchApps(ctx)
			if err != nil {
				return h.formatUseCaseError(cmd, err)
			}

			application, ok, err := h.tui.PickApplication(apps, "Select the application")
			if err != nil {
				return h.formatUseCaseError(cmd, err)
			}
			if !ok {
				return h.formatUseCaseError(cmd, service_token.ErrTokenCreateCancelled)
			}
			appID = application.ID
		}

		if envTypeID == "" {
			envs, err := h.fetchEnvs(ctx, appID)
			if err != nil {
				return h.formatUseCaseError(cmd, err)
			}

			env, ok, err := h.tui.PickEnvironment(envs, "Select the environment")
			if err != nil {
				return h.formatUseCaseError(cmd, err)
			}
			if !ok {
				return h.formatUseCaseError(cmd, service_token.ErrTokenCreateCancelled)
			}
			envTypeID = env.ID
		}

		values, err := h.tui.CreateTokenTUI(factory.ServiceTokenCreateValues{
			Name:          name,
			Read:          read,
			Write:         write,
			ExpiresInDays: expiresInDays,
		})
		if err != nil {
			return h.formatUseCaseError(cmd, err)
		}
		name = values.Name
		permissions = &domain.ServiceTokenPermissions{Read: values.Read, Write: values.Write}
		expiresInDays = values.ExpiresInDays
	}

	req := &domain.ServiceToken{
		Name:          name,
		AppID:         appID,
		EnvTypeID:     envTypeID,
		Permissions:   permissions,
		ExpiresInDays: expiresInDays,
	}

	// Show progress while the token is created, then hand the screen over to
	// the success message.
	sp := spinner.New("Creating service token…", spinner.IsTerminal(os.Stderr), os.Stderr)

	if !jsonOutput {
		sp.Start()
	}
	token, err := h.createUseCase.Execute(ctx, req)
	if !jsonOutput {
		sp.Stop()
	}
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if jsonOutput {
		return h.formatter.FormatJSON(cmd.Writer, token)
	}

	return h.formatter.FormatCreateSuccessMessage(cmd.Writer, token)
}

// fetchApps loads the applications with the shared loader presentation.
func (h *ServiceTokenHandler) fetchApps(ctx context.Context) ([]domain.Application, error) {
	sp := spinner.New("Fetching applications…", spinner.IsTerminal(os.Stderr), os.Stderr)
	sp.Start()
	defer sp.Stop()

	apps, err := h.listApps.Execute(ctx)
	if err != nil {
		return nil, err
	}
	if len(apps) == 0 {
		return nil, service_token.NewServiceTokenValidationError("no applications available; create one with 'envsync app create'", service_token.ErrNoApplications)
	}
	return apps, nil
}

// fetchEnvs loads the application's environments with the shared loader
// presentation.
func (h *ServiceTokenHandler) fetchEnvs(ctx context.Context, appID string) ([]domain.EnvType, error) {
	sp := spinner.New("Fetching environments…", spinner.IsTerminal(os.Stderr), os.Stderr)
	sp.Start()
	defer sp.Stop()

	envs, err := h.getEnvs.ExecuteByAppID(ctx, appID)
	if err != nil {
		return nil, err
	}
	if len(envs) == 0 {
		return nil, service_token.NewServiceTokenValidationError("no environments available for this application", service_token.ErrNoEnvironments)
	}
	return envs, nil
}

func (h *ServiceTokenHandler) List(ctx context.Context, cmd *cli.Command) error {
	// Show progress while the tokens load, then hand the screen over to the view.
	sp := spinner.New("Fetching service tokens…", spinner.IsTerminal(os.Stderr), os.Stderr)
	if !cmd.Bool("json") {
		sp.Start()
	}
	tokens, err := h.listUseCase.Execute(ctx)
	if !cmd.Bool("json") {
		sp.Stop()
	}
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, tokens)
	}

	// A terminal gets the table TUI. Pipes and scripts keep the plain table so
	// existing pipelines are unaffected.
	if len(tokens) > 0 && spinner.IsTerminal(cmd.Writer) {
		return h.tui.ListTokensInteractive(tokens)
	}

	return h.formatter.FormatListTable(cmd.Writer, tokens)
}

func (h *ServiceTokenHandler) Get(ctx context.Context, cmd *cli.Command) error {
	jsonOutput := cmd.Bool("json")
	id := cmd.String("id")

	// Without --id a terminal picks the token from a summary table. JSON is
	// for scripts: it takes flag values only and never opens the TUI.
	if id == "" {
		if jsonOutput {
			return h.formatUseCaseError(cmd, service_token.NewServiceTokenValidationError("id must be provided with json flag", service_token.ErrTokenIDRequired))
		}
		if !spinner.IsTerminal(os.Stdin) {
			return h.formatUseCaseError(cmd, service_token.NewServiceTokenValidationError("id is required; provide --id flag", service_token.ErrTokenIDRequired))
		}

		tokens, err := h.fetchTokens(ctx)
		if err != nil {
			return h.formatUseCaseError(cmd, err)
		}

		token, ok, err := h.tui.PickToken(tokens, "Select the service token")
		if err != nil {
			return h.formatUseCaseError(cmd, err)
		}
		if !ok {
			return h.formatUseCaseError(cmd, service_token.ErrTokenSelectionCancelled)
		}
		id = token.ID
	}

	token, err := h.getUseCase.Execute(ctx, id)
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if jsonOutput {
		return h.formatter.FormatJSON(cmd.Writer, token)
	}

	return h.formatter.FormatGetSuccessMessage(cmd.Writer, token)
}

// fetchTokens loads the service tokens with the shared loader presentation.
func (h *ServiceTokenHandler) fetchTokens(ctx context.Context) ([]domain.ServiceToken, error) {
	sp := spinner.New("Fetching service tokens…", spinner.IsTerminal(os.Stderr), os.Stderr)
	sp.Start()
	defer sp.Stop()

	tokens, err := h.listUseCase.Execute(ctx)
	if err != nil {
		return nil, err
	}
	if len(tokens) == 0 {
		return nil, service_token.NewServiceTokenValidationError("no service tokens available; create one with 'envsync service-token create'", service_token.ErrNoTokens)
	}
	return tokens, nil
}

func (h *ServiceTokenHandler) Delete(ctx context.Context, cmd *cli.Command) error {
	jsonOutput := cmd.Bool("json")
	id := cmd.String("id")

	// Without --id a terminal picks the token to delete. JSON is for scripts:
	// it takes flag values only and never opens the TUI.
	if id == "" {
		if jsonOutput {
			return h.formatUseCaseError(cmd, service_token.NewServiceTokenValidationError("id must be provided with json flag", service_token.ErrTokenIDRequired))
		}
		if !spinner.IsTerminal(os.Stdin) {
			return h.formatUseCaseError(cmd, service_token.NewServiceTokenValidationError("id is required; provide --id flag", service_token.ErrTokenIDRequired))
		}

		tokens, err := h.fetchTokens(ctx)
		if err != nil {
			return h.formatUseCaseError(cmd, err)
		}

		token, ok, err := h.tui.PickTokenToDelete(tokens, "Select the service token to delete")
		if err != nil {
			return h.formatUseCaseError(cmd, err)
		}
		if !ok {
			return h.formatUseCaseError(cmd, service_token.ErrTokenSelectionCancelled)
		}
		id = token.ID
	}

	if err := h.deleteUseCase.Execute(ctx, id); err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if jsonOutput {
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
			return h.formatter.FormatError(cmd.ErrWriter, "Validation error: "+stErr.Message)
		case service_token.ServiceTokenErrorCodeNotFound:
			return h.formatter.FormatError(cmd.ErrWriter, "Service token not found: "+stErr.Message)
		case service_token.ServiceTokenErrorCodeAccessDenied:
			return h.formatter.FormatError(cmd.ErrWriter, "Access denied: "+stErr.Message)
		default:
			return h.formatter.FormatError(cmd.ErrWriter, "Service error: "+stErr.Message)
		}
	}

	return h.formatter.FormatError(cmd.ErrWriter, "Unexpected error: "+err.Error())
}
