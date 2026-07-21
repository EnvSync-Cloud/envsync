package init

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/BurntSushi/toml"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/constants"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type initCaseUse struct {
	appService services.ApplicationService
}

func NewInitUseCase() InitUseCase {
	appService := services.NewAppService()
	return &initCaseUse{
		appService: appService,
	}
}

func (uc *initCaseUse) Execute(ctx context.Context, config string) error {
	return uc.ExecuteWithOptions(ctx, config, "", "")
}

func (uc *initCaseUse) ExecuteWithOptions(ctx context.Context, config string, appID string, envTypeID string) error {
	ctx, span := telemetry.Tracer().Start(ctx, "project.init")
	defer span.End()

	if err := uc.checkConfigExists(config); err == nil {
		return err
	}

	apps, err := uc.appService.GetAllApps(ctx)
	if err != nil {
		return NewServiceError("failed to retrieve applications", err)
	}

	if len(apps) == 0 {
		return NewNotFoundError("no applications found. Create an application first with 'envsync app create'", nil)
	}

	var selectedAppID, selectedEnvID string

	if appID != "" {
		selectedAppID = appID
		selectedEnvID = envTypeID
	} else {
		selectedAppID, selectedEnvID, err = uc.selectAppAndEnv(ctx, apps)
		if err != nil {
			return err
		}
	}

	syncConfig := domain.SyncConfig{
		AppID:     selectedAppID,
		EnvTypeID: selectedEnvID,
	}

	return uc.saveConfig(syncConfig)
}

func (uc *initCaseUse) selectAppAndEnv(ctx context.Context, apps []domain.Application) (string, string, error) {
	reader := bufio.NewReader(os.Stdin)

	fmt.Println("\n📋 Available Applications:")
	fmt.Println(strings.Repeat("-", 60))
	for i, app := range apps {
		fmt.Printf("  %d) %s (ID: %s)\n", i+1, app.Name, app.ID)
	}
	fmt.Println(strings.Repeat("-", 60))

	fmt.Print("\nSelect application (enter number or ID): ")
	input, _ := reader.ReadString('\n')
	input = strings.TrimSpace(input)

	var selectedApp *domain.Application
	for i, app := range apps {
		if input == fmt.Sprintf("%d", i+1) || input == app.ID || strings.EqualFold(input, app.Name) {
			selectedApp = &apps[i]
			break
		}
	}

	if selectedApp == nil {
		return "", "", NewNotFoundError("application not found: "+input, nil)
	}

	if len(selectedApp.EnvTypes) == 0 {
		return selectedApp.ID, "", nil
	}

	fmt.Printf("\n🌍 Available Environments for %s:\n", selectedApp.Name)
	fmt.Println(strings.Repeat("-", 60))
	for i, env := range selectedApp.EnvTypes {
		fmt.Printf("  %d) %s (ID: %s)\n", i+1, env.Name, env.ID)
	}
	fmt.Println(strings.Repeat("-", 60))

	fmt.Print("\nSelect environment (enter number or ID): ")
	envInput, _ := reader.ReadString('\n')
	envInput = strings.TrimSpace(envInput)

	for i, env := range selectedApp.EnvTypes {
		if envInput == fmt.Sprintf("%d", i+1) || envInput == env.ID || strings.EqualFold(envInput, env.Name) {
			return selectedApp.ID, env.ID, nil
		}
	}

	return "", "", NewNotFoundError("environment not found: "+envInput, nil)
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
