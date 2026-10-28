package environment

import (
	"context"
	"os"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/spinner"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/factory"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type switchEnvUseCase struct {
	envTypeService services.EnvTypeService
	syncService    services.SyncService
	appService     services.ApplicationService
}

func NewSwitchEnvUseCase() SwitchEnvUseCase {
	return &switchEnvUseCase{
		envTypeService: services.NewEnvTypeService(),
		syncService:    services.NewSyncService(),
		appService:     services.NewAppService(),
	}
}

func (uc *switchEnvUseCase) Execute(ctx context.Context, envType domain.EnvType) (result domain.EnvType, err error) {
	ctx, end := telemetry.StartSpan(ctx, "environment.switch",
		trace.WithAttributes(
			attribute.String("env.id", envType.ID),
			attribute.String("env.name", envType.Name),
			attribute.String("app.id", envType.AppID),
		))
	defer end(&err)

	syncConfig, err := uc.readSyncConfig()
	if err != nil {
		return domain.EnvType{}, err
	}

	appID, err := uc.resolveAppID(ctx, syncConfig)
	if err != nil {
		return domain.EnvType{}, err
	}

	envs, err := uc.fetchAvailableEnvs(ctx, appID)
	if err != nil {
		return domain.EnvType{}, err
	}

	selected, err := uc.resolveSelection(envs, envType)
	if err != nil {
		return domain.EnvType{}, err
	}

	if err := uc.updateSyncConfigWithEnv(syncConfig, selected); err != nil {
		return domain.EnvType{}, err
	}

	return selected, nil
}

func (uc *switchEnvUseCase) readSyncConfig() (*domain.SyncConfig, error) {
	syncConfig, err := uc.syncService.ReadConfigData()
	if err != nil {
		return nil, NewFileSystemError("failed to read sync config", err)
	}
	return &syncConfig, nil
}

func (uc *switchEnvUseCase) fetchAvailableEnvs(ctx context.Context, appID string) ([]domain.EnvType, error) {
	sp := spinner.New("Fetching environments…", spinner.IsTerminal(os.Stderr), os.Stderr)
	sp.Start()
	envs, err := uc.envTypeService.GetEnvTypesByAppID(ctx, appID)
	sp.Stop()
	if err != nil {
		return nil, NewServiceError("failed to fetch environment types", err)
	}
	if len(envs) == 0 {
		return nil, NewNotFoundError("no environment types found for the current app", nil)
	}
	return envs, nil
}

// resolveSelection honours an explicit --env-id, and otherwise asks the user
// to pick one from a table.
func (uc *switchEnvUseCase) resolveSelection(envs []domain.EnvType, want domain.EnvType) (domain.EnvType, error) {
	if want.ID != "" {
		for _, env := range envs {
			if env.ID == want.ID {
				return env, nil
			}
		}
		return domain.EnvType{}, NewNotFoundError("environment type not found: "+want.ID, nil)
	}

	selected, ok, err := factory.PickEnvType(envs, "Switch environment")
	if err != nil {
		return domain.EnvType{}, NewTUIError("failed to select environment", err)
	}
	if !ok {
		return domain.EnvType{}, NewCancelledError("environment switch cancelled by user", nil)
	}

	return selected, nil
}

func (uc *switchEnvUseCase) resolveAppID(ctx context.Context, syncConfig *domain.SyncConfig) (string, error) {
	if name := strings.TrimSpace(syncConfig.AppName); name != "" {
		apps, err := uc.appService.GetAllApps(ctx)
		if err != nil {
			return "", NewServiceError("failed to resolve application "+name, err)
		}
		app, err := domain.FindAppByName(apps, name)
		if err != nil {
			return "", NewNotFoundError(err.Error(), err)
		}
		return app.ID, nil
	}
	if strings.TrimSpace(syncConfig.AppID) == "" {
		return "", NewValidationError("envsyncrc.toml has no app_name", "", nil)
	}
	return syncConfig.AppID, nil
}

func (uc *switchEnvUseCase) updateSyncConfigWithEnv(syncConfig *domain.SyncConfig, envType domain.EnvType) error {
	syncConfig.EnvTypeName = strings.TrimSpace(envType.Name)
	syncConfig.EnvTypeID = ""
	if err := uc.syncService.WriteConfigData(*syncConfig); err != nil {
		return NewFileSystemError("failed to update sync config with selected environment type", err)
	}
	return nil
}
