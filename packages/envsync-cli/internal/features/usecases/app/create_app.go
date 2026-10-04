package app

import (
	"context"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"sync"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/spinner"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/factory"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type createAppUseCase struct {
	appService services.ApplicationService
	envService services.EnvTypeService
	tui        *factory.AppFactory
}

func NewCreateAppUseCase() CreateAppUseCase {
	as := services.NewAppService()
	es := services.NewEnvTypeService()
	tui := factory.NewAppFactory()
	return &createAppUseCase{
		appService: as,
		envService: es,
		tui:        tui,
	}
}

func (uc *createAppUseCase) Execute(ctx context.Context, app domain.Application) (*domain.Application, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "app.create")
	defer span.End()

	// A missing name means the TUI supplies it, so duplicate detection has to
	// wait until the name is final — otherwise apps created interactively were
	// never checked at all.
	if app.Name == "" {
		a, err := uc.tui.CreateAppTUI(ctx, &app)
		if err != nil {
			return nil, NewServiceError("failed to create application via TUI", err)
		}
		app = *a
	}

	// The form is complete at this point. Keep a visible status while the
	// request runs so the command does not look hung, and clear it on the way
	// out so the caller's success output takes its place.
	sp := spinner.New("Creating application…", spinner.IsTerminal(os.Stderr), os.Stderr)
	sp.Start()
	defer sp.Stop()

	if exists, err := uc.checkApplicationExists(ctx, app.Name); err != nil {
		return nil, NewServiceError("failed to check application existence", err)
	} else if exists {
		return nil, NewAlreadyExistsError(
			fmt.Sprintf("application with name '%s' already exists", app.Name),
			ErrAppAlreadyExists,
		)
	}

	// Validate business validation
	if err := uc.validateBusinessRules(app); err != nil {
		return nil, err
	}

	// Create application via service
	createdApp, err := uc.appService.CreateApp(ctx, &app)
	if err != nil {
		return nil, NewServiceError("failed to create application", err)
	}

	// Create one environment type per requested entry, concurrently.
	if len(app.EnvTypes) > 0 {
		created := make([]domain.EnvType, len(app.EnvTypes))
		errs := make([]error, len(app.EnvTypes))

		var wg sync.WaitGroup
		wg.Add(len(app.EnvTypes))

		for i, envType := range app.EnvTypes {
			// Each goroutine owns exactly one index, so there is no sharing to
			// synchronise; wg.Wait() below publishes the results.
			go func(i int, envType domain.EnvType) {
				defer wg.Done()
				created[i], errs[i] = uc.envService.CreateEnvType(
					ctx,
					domain.NewEnvType(createdApp.ID, envType.Name, envType.IsDefault, envType.IsProtected, envType.Color),
				)
			}(i, envType)
		}

		wg.Wait()

		// Report every failure, not just the first, and name the one that failed.
		for i, err := range errs {
			if err != nil {
				errs[i] = fmt.Errorf("%s: %w", app.EnvTypes[i].Name, err)
			}
		}
		if err := errors.Join(errs...); err != nil {
			return nil, NewServiceError("failed to create environment types", err)
		}

		// Report what was actually created so the caller can show it.
		createdApp.EnvTypes = append(createdApp.EnvTypes, created...)
	}

	return &createdApp, nil
}

func (uc *createAppUseCase) validateBusinessRules(app domain.Application) error {
	// Validate name length
	if len(app.Name) > 100 {
		return NewValidationError("application name too long", ErrAppNameTooLong)
	}

	// Validate name is not empty
	if strings.TrimSpace(app.Name) == "" {
		return NewValidationError("application name cannot be empty", ErrAppNameEmpty)
	}

	if strings.TrimSpace(app.Description) == "" {
		return NewValidationError("application description is required", ErrAppDescriptionRequired)
	}

	// Validate description length
	if len(app.Description) > 500 {
		return NewValidationError("application description too long", ErrAppDescriptionTooLong)
	}

	// Validate name format (alphanumeric, hyphens, underscores only)
	if !uc.isValidAppName(app.Name) {
		return NewValidationError("invalid application name format", ErrInvalidAppName)
	}

	// Validate metadata size
	if err := uc.validateMetadata(app.Metadata); err != nil {
		return NewValidationError("invalid metadata", err)
	}

	return nil
}

func (uc *createAppUseCase) isValidAppName(name string) bool {
	// Allow alphanumeric characters, hyphens, and underscores
	// Must start with a letter or number
	pattern := `^[a-zA-Z0-9][a-zA-Z0-9 _-]*$`
	matched, _ := regexp.MatchString(pattern, name)
	return matched
}

func (uc *createAppUseCase) validateMetadata(metadata map[string]any) error {
	if len(metadata) > 20 {
		return fmt.Errorf("too many metadata entries (max 20)")
	}

	for key, value := range metadata {
		// Validate key format
		if len(key) > 50 {
			return fmt.Errorf("metadata key '%s' is too long (max 50 characters)", key)
		}

		if !uc.isValidMetadataKey(key) {
			return fmt.Errorf("metadata key '%s' contains invalid characters", key)
		}

		// Validate value
		if err := uc.validateMetadataValue(key, value); err != nil {
			return err
		}
	}

	return nil
}

func (uc *createAppUseCase) isValidMetadataKey(key string) bool {
	// Allow alphanumeric characters, hyphens, underscores, and dots
	pattern := `^[a-zA-Z0-9._-]+$`
	matched, _ := regexp.MatchString(pattern, key)
	return matched
}

func (uc *createAppUseCase) validateMetadataValue(key string, value any) error {
	switch v := value.(type) {
	case string:
		if len(v) > 200 {
			return fmt.Errorf("metadata value for key '%s' is too long (max 200 characters)", key)
		}
	case int, int32, int64, float32, float64, bool:
		// These types are acceptable
	default:
		return fmt.Errorf("metadata value for key '%s' has unsupported type", key)
	}

	return nil
}

func (uc *createAppUseCase) checkApplicationExists(ctx context.Context, name string) (bool, error) {
	// Get all applications and check if name exists
	apps, err := uc.appService.GetAllApps(ctx)
	if err != nil {
		return false, err
	}

	for _, app := range apps {
		if strings.EqualFold(app.Name, name) {
			return true, nil
		}
	}

	return false, nil
}
