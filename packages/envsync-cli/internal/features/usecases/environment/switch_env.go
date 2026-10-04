package environment

import (
	"context"
	"os"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/spinner"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/factory"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
)

type switchEnvUseCase struct {
	envTypeService services.EnvTypeService
	syncService    services.SyncService
}

func NewSwitchEnvUseCase() SwitchEnvUseCase {
	envTypeService := services.NewEnvTypeService()
	syncService := services.NewSyncService()

	return &switchEnvUseCase{
		envTypeService: envTypeService,
		syncService:    syncService,
	}
}

func (uc *switchEnvUseCase) Execute(ctx context.Context, envType domain.EnvType) (domain.EnvType, error) {
	syncConfig, err := uc.readSyncConfig()
	if err != nil {
		return domain.EnvType{}, err
	}

	envs, err := uc.fetchAvailableEnvs(ctx, syncConfig.AppID)
	if err != nil {
		return domain.EnvType{}, err
	}

	selected, err := uc.resolveSelection(envs, envType)
	if err != nil {
		return domain.EnvType{}, err
	}

	if err := uc.updateSyncConfigWithEnv(syncConfig, selected.ID); err != nil {
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

func (uc *switchEnvUseCase) updateSyncConfigWithEnv(syncConfig *domain.SyncConfig, envTypeID string) error {
	syncConfig.EnvTypeID = envTypeID
	if err := uc.syncService.WriteConfigData(*syncConfig); err != nil {
		return NewFileSystemError("failed to update sync config with selected environment type", err)
	}
	return nil
}
