package environment

import (
	"context"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/presentation/tui/factory"
	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
)

type switchEnvUseCase struct {
	envTypeService services.EnvTypeService
	syncService    services.SyncService
	tui            *factory.EnvFactory
}

func NewSwitchEnvUseCase() SwitchEnvUseCase {
	envTypeService := services.NewEnvTypeService()
	syncService := services.NewSyncService()
	tui := factory.NewEnvFactory()

	return &switchEnvUseCase{
		envTypeService: envTypeService,
		syncService:    syncService,
		tui:            tui,
	}
}

func (uc *switchEnvUseCase) Execute(ctx context.Context, envType domain.EnvType) error {
	syncConfig, err := uc.readSyncConfig()
	if err != nil {
		return err
	}

	envs, err := uc.fetchAvailableEnvs(syncConfig.AppID)
	if err != nil {
		return err
	}

	selectedEnv, err := uc.selectEnvironment(envs)
	if err != nil {
		return err
	}

	if err := uc.updateSyncConfigWithEnv(syncConfig, selectedEnv.ID); err != nil {
		return err
	}

	return nil
}

func (uc *switchEnvUseCase) readSyncConfig() (*domain.SyncConfig, error) {
	syncConfig, err := uc.syncService.ReadConfigData()
	if err != nil {
		return nil, NewFileSystemError("failed to read sync config", err)
	}
	return &syncConfig, nil
}

func (uc *switchEnvUseCase) fetchAvailableEnvs(appID string) ([]domain.EnvType, error) {
	envs, err := uc.envTypeService.GetEnvTypesByAppID(appID)
	if err != nil {
		return nil, NewServiceError("failed to fetch environment types", err)
	}
	if len(envs) == 0 {
		return nil, NewNotFoundError("no environment types found for the current app", nil)
	}
	return envs, nil
}

func (uc *switchEnvUseCase) selectEnvironment(envs []domain.EnvType) (*domain.EnvType, error) {
	selectedEnv, err := uc.tui.SelectEnvironmentTUI(envs)
	if err != nil {
		if err == tea.ErrProgramKilled {
			return nil, nil // User cancelled the selection
		}
		return nil, NewServiceError("failed to select environment type", err)
	}
	return &selectedEnv, nil
}

func (uc *switchEnvUseCase) updateSyncConfigWithEnv(syncConfig *domain.SyncConfig, envTypeID string) error {
	syncConfig.EnvTypeID = envTypeID
	if err := uc.syncService.WriteConfigData(*syncConfig); err != nil {
		return NewFileSystemError("failed to update sync config with selected environment type", err)
	}
	return nil
}
