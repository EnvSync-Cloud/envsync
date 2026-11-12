package init

import (
	"context"
	"fmt"
	"os"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/BurntSushi/toml"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/constants"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/spinner"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/factory"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type initCaseUse struct {
	appService services.ApplicationService
	envService services.EnvTypeService
	tui        *factory.InitFactory
}

func NewInitUseCase(tui *factory.InitFactory) InitUseCase {
	return &initCaseUse{
		appService: services.NewAppService(),
		envService: services.NewEnvTypeService(),
		tui:        tui,
	}
}

func (uc *initCaseUse) Execute(ctx context.Context, config string) (InitResult, error) {
	return uc.ExecuteWithOptions(ctx, config, "", "")
}

func (uc *initCaseUse) ExecuteWithOptions(ctx context.Context, config string, appID string, envTypeID string) (result InitResult, err error) {
	ctx, end := telemetry.StartSpan(ctx, "project.init", trace.WithAttributes(
		attribute.String("config.path", config),
		attribute.String("app.id", appID),
		attribute.String("env.id", envTypeID),
	))
	defer end(&err)

	if err := uc.checkConfigExists(config); err == nil {
		return InitResult{}, err
	}

	sp := spinner.New("Fetching applications…", spinner.IsTerminal(os.Stderr), os.Stderr)
	sp.Start()
	apps, err := uc.appService.GetAllApps(ctx)
	sp.Stop()
	if err != nil {
		return InitResult{}, NewServiceError("failed to retrieve applications", err)
	}

	if len(apps) == 0 {
		return InitResult{}, NewNotFoundError("no applications found. Create an application first with 'envsync app create'", nil)
	}

	var selectedApp domain.Application
	var selectedEnv domain.EnvType

	if appID != "" {
		for _, app := range apps {
			if app.ID == appID {
				selectedApp = app
				break
			}
		}
		if selectedApp.ID == "" {
			return InitResult{}, NewNotFoundError("application not found: "+appID, nil)
		}

		if envTypeID == "" {
			selectedEnv, err = uc.selectEnvType(ctx, selectedApp.ID, selectedApp.Name)
			if err != nil {
				return InitResult{}, err
			}
		} else {
			envTypes, err := uc.fetchEnvTypes(ctx, selectedApp.ID, selectedApp.Name)
			if err != nil {
				return InitResult{}, err
			}
			for _, envType := range envTypes {
				if envType.ID == envTypeID {
					selectedEnv = envType
					break
				}
			}
			if selectedEnv.ID == "" {
				return InitResult{}, NewNotFoundError("environment type not found: "+envTypeID, nil)
			}
		}
	} else {
		selectedApp, selectedEnv, err = uc.selectAppAndEnv(ctx, apps)
		if err != nil {
			return InitResult{}, err
		}
	}

	syncConfig := domain.SyncConfig{
		AppName:     strings.TrimSpace(selectedApp.Name),
		EnvTypeName: strings.TrimSpace(selectedEnv.Name),
	}

	if err := uc.saveConfig(syncConfig); err != nil {
		return InitResult{}, err
	}

	return InitResult{
		Path:        constants.DefaultProjectConfig,
		AppID:       selectedApp.ID,
		EnvTypeID:   selectedEnv.ID,
		AppName:     syncConfig.AppName,
		EnvTypeName: syncConfig.EnvTypeName,
	}, nil
}

// fetchEnvTypes loads an application's environment types. The application list
// does not carry them, so they have to be fetched per application.
func (uc *initCaseUse) fetchEnvTypes(ctx context.Context, appID, appName string) ([]domain.EnvType, error) {
	sp := spinner.New(fmt.Sprintf("Fetching environments for %s…", appName), spinner.IsTerminal(os.Stderr), os.Stderr)
	sp.Start()
	envTypes, err := uc.envService.GetEnvTypesByAppID(ctx, appID)
	sp.Stop()
	if err != nil {
		return nil, NewServiceError("failed to retrieve environment types", err)
	}
	return envTypes, nil
}

func (uc *initCaseUse) selectAppAndEnv(ctx context.Context, apps []domain.Application) (domain.Application, domain.EnvType, error) {
	selected, ok, err := uc.tui.PickApp(apps)
	if err != nil {
		return domain.Application{}, domain.EnvType{}, NewTUIError("failed to select application", err)
	}
	if !ok {
		return domain.Application{}, domain.EnvType{}, NewCancelledError("initialisation cancelled by user", nil)
	}

	env, err := uc.selectEnvType(ctx, selected.ID, selected.Name)
	if err != nil {
		return domain.Application{}, domain.EnvType{}, err
	}

	return selected, env, nil
}

func (uc *initCaseUse) selectEnvType(ctx context.Context, appID, appName string) (domain.EnvType, error) {
	envTypes, err := uc.fetchEnvTypes(ctx, appID, appName)
	if err != nil {
		return domain.EnvType{}, err
	}
	if len(envTypes) == 0 {
		return domain.EnvType{}, NewNotFoundError("no environment types found \n Create one using 'envsync env create'", nil)
	}

	env, ok, err := factory.PickEnvType(envTypes, "Select an environment for "+appName)
	if err != nil {
		return domain.EnvType{}, NewTUIError("failed to select environment", err)
	}
	if !ok {
		return domain.EnvType{}, NewCancelledError("initialisation cancelled by user", nil)
	}

	return env, nil
}

func (uc *initCaseUse) checkConfigExists(configPath string) error {
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return NewNotFoundError("configuration file does not exist at path: "+configPath, err)
	}
	return nil
}

func (uc *initCaseUse) saveConfig(cfg domain.SyncConfig) error {
	file, err := os.Create(constants.DefaultProjectConfig)
	if err != nil {
		return NewFileSystemError("failed to create configuration file", constants.DefaultProjectConfig, err)
	}
	defer file.Close()

	err = toml.NewEncoder(file).Encode(cfg)
	if err != nil {
		return NewFileSystemError("failed to write configuration file", constants.DefaultProjectConfig, err)
	}

	return nil
}
