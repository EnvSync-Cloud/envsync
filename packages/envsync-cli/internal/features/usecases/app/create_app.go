package app

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"sync"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/presentation/tui/factory"
	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
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
	if app.Name != "" {
		// Check if application with same name already exists
		if exists, err := uc.checkApplicationExists(app.Name); err != nil {
			return nil, NewServiceError("failed to check application existence", err)
		} else if exists {
			return nil, NewAlreadyExistsError(
				fmt.Sprintf("application with name '%s' already exists", app.Name),
				ErrAppAlreadyExists,
			)
		}
	}

	// var inputApp *domain.Application
	if app.Name == "" {
		a, err := uc.tui.CreateAppTUI(ctx, &app)
		if err != nil {
			return nil, NewServiceError("failed to create application via TUI", err)
		}
		app = *a
	}

	// Validate business validation
	if err := uc.validateBusinessRules(app); err != nil {
		return nil, err
	}

	// Create application via service
	createdApp, err := uc.appService.CreateApp(&app)
	if err != nil {
		return nil, NewServiceError("failed to create application", err)
	}

	setDefaultEnv := ctx.Value("setDefaultEnv")
	if setDefaultEnv != nil && setDefaultEnv.(bool) {
		var wg sync.WaitGroup
		var prodErr, devErr error

		wg.Add(2)

		// Create PROD environment type
		go func() {
			defer wg.Done()
			prodEnvType := domain.NewEnvType(createdApp.ID, "PROD", false, false, "")
			_, prodErr = uc.envService.CreateEnvType(prodEnvType)
		}()

		// Create DEV environment type
		go func() {
			defer wg.Done()
			devEnvType := domain.NewEnvType(createdApp.ID, "DEV", false, false, "")
			_, devErr = uc.envService.CreateEnvType(devEnvType)
		}()

		wg.Wait()

		if prodErr != nil {
			return nil, NewServiceError("failed to create PROD environment type", prodErr)
		}
		if devErr != nil {
			return nil, NewServiceError("failed to create DEV environment type", devErr)
		}
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

	// Validate description length
	if len(app.Description) > 1 && len(app.Description) > 500 {
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

func (uc *createAppUseCase) checkApplicationExists(name string) (bool, error) {
	// Get all applications and check if name exists
	apps, err := uc.appService.GetAllApps()
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
