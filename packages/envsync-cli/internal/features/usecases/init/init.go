package init

import (
	"context"
	"os"

	"github.com/BurntSushi/toml"
	"github.com/EnvSync-Cloud/envsync-cli/internal/constants"
	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/presentation/tui/factory"
	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
)

type initCaseUse struct {
	appService services.ApplicationService
	tui        *factory.InitFactory
}

func NewInitUseCase() InitUseCase {
	tui := factory.NewInitFactory()
	appService := services.NewAppService()
	return &initCaseUse{
		appService: appService,
		tui:        tui,
	}
}

func (uc *initCaseUse) Execute(ctx context.Context, config string) error {
	// Check if the configuration file already exists
	if err := uc.checkConfigExists(config); err == nil {
		return err
	}

	// Fetch all the applications
	apps, err := uc.appService.GetAllApps()
	if err != nil {
		return NewServiceError("failed to retrieve applications", err)
	}

	// Open a form to collect user input for the configuration
	appID, envID, err := uc.tui.OpenInitForm(apps)
	if err != nil {
		return NewTUIError("failed to open configuration form", err)
	}

	syncConfig := domain.SyncConfig{
		AppID:     appID,
		EnvTypeID: envID,
	}

	if err := uc.saveConfig(syncConfig); err != nil {
		return err
	}

	return nil
}

func (uc *initCaseUse) checkConfigExists(configPath string) error {
	// Check if the configuration file exists at the specified path
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
