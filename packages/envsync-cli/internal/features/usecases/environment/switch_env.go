package environment

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
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

func (uc *switchEnvUseCase) Execute(ctx context.Context, envType domain.EnvType) error {
	syncConfig, err := uc.readSyncConfig()
	if err != nil {
		return err
	}

	envs, err := uc.fetchAvailableEnvs(ctx, syncConfig.AppID)
	if err != nil {
		return err
	}

	if envType.ID != "" {
		for _, env := range envs {
			if env.ID == envType.ID {
				return uc.updateSyncConfigWithEnv(syncConfig, env.ID)
			}
		}
		return NewNotFoundError("environment type not found: "+envType.ID, nil)
	}

	selectedEnv, err := uc.selectEnvironmentInteractive(envs)
	if err != nil {
		return err
	}

	return uc.updateSyncConfigWithEnv(syncConfig, selectedEnv.ID)
}

func (uc *switchEnvUseCase) readSyncConfig() (*domain.SyncConfig, error) {
	syncConfig, err := uc.syncService.ReadConfigData()
	if err != nil {
		return nil, NewFileSystemError("failed to read sync config", err)
	}
	return &syncConfig, nil
}

func (uc *switchEnvUseCase) fetchAvailableEnvs(ctx context.Context, appID string) ([]domain.EnvType, error) {
	envs, err := uc.envTypeService.GetEnvTypesByAppID(ctx, appID)
	if err != nil {
		return nil, NewServiceError("failed to fetch environment types", err)
	}
	if len(envs) == 0 {
		return nil, NewNotFoundError("no environment types found for the current app", nil)
	}
	return envs, nil
}

func (uc *switchEnvUseCase) selectEnvironmentInteractive(envs []domain.EnvType) (*domain.EnvType, error) {
	reader := bufio.NewReader(os.Stdin)

	fmt.Println("\n🌍 Available Environments:")
	fmt.Println(strings.Repeat("-", 60))
	for i, env := range envs {
		fmt.Printf("  %d) %s (ID: %s)\n", i+1, env.Name, env.ID)
	}
	fmt.Println(strings.Repeat("-", 60))

	fmt.Print("\nSelect environment (enter number or ID): ")
	input, _ := reader.ReadString('\n')
	input = strings.TrimSpace(input)

	for i, env := range envs {
		if input == fmt.Sprintf("%d", i+1) || input == env.ID || strings.EqualFold(input, env.Name) {
			return &envs[i], nil
		}
	}

	return nil, NewNotFoundError("environment not found: "+input, nil)
}

func (uc *switchEnvUseCase) updateSyncConfigWithEnv(syncConfig *domain.SyncConfig, envTypeID string) error {
	syncConfig.EnvTypeID = envTypeID
	if err := uc.syncService.WriteConfigData(*syncConfig); err != nil {
		return NewFileSystemError("failed to update sync config with selected environment type", err)
	}
	return nil
}
