package app

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type deleteAppUseCase struct {
	appService services.ApplicationService
}

func NewDeleteAppUseCase() DeleteAppUseCase {
	service := services.NewAppService()
	return &deleteAppUseCase{
		appService: service,
	}
}

func (uc *deleteAppUseCase) Execute(ctx context.Context) ([]domain.Application, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "app.delete")
	defer span.End()

	appID, _ := ctx.Value("appID").(string)
	appName, _ := ctx.Value("appName").(string)

	var deletedApps []domain.Application
	var err error

	switch {
	case appID == "" && appName == "":
		deletedApps, err = uc.deleteAppsInteractive(ctx)
	case appID != "":
		deletedApps, err = uc.deleteAppByID(ctx, appID)
	case appName != "":
		deletedApps, err = uc.deleteAppByName(ctx, appName)
	}

	if err != nil {
		return nil, err
	}

	return deletedApps, nil
}

func (uc *deleteAppUseCase) deleteAppsInteractive(ctx context.Context) ([]domain.Application, error) {
	apps, err := uc.appService.GetAllApps(ctx)
	if err != nil {
		return nil, NewServiceError("failed to retrieve applications", err)
	}

	if len(apps) == 0 {
		return nil, NewNotFoundError("no applications found", nil)
	}

	reader := bufio.NewReader(os.Stdin)

	fmt.Println("\n🗑️  Available Applications:")
	fmt.Println(strings.Repeat("-", 60))
	for i, app := range apps {
		fmt.Printf("  %d) %s (ID: %s)\n", i+1, app.Name, app.ID)
	}
	fmt.Println(strings.Repeat("-", 60))

	fmt.Print("\nSelect application to delete (enter number or ID): ")
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
		return nil, NewNotFoundError("application not found: "+input, nil)
	}

	fmt.Printf("\n⚠️  Are you sure you want to delete '%s'? (y/N): ", selectedApp.Name)
	confirm, _ := reader.ReadString('\n')
	confirm = strings.TrimSpace(strings.ToLower(confirm))

	if confirm != "y" && confirm != "yes" {
		return nil, NewCancelledError("deletion cancelled by user", nil)
	}

	if err := uc.appService.DeleteApp(ctx, *selectedApp); err != nil {
		return nil, NewServiceError("failed to delete application", err)
	}

	return []domain.Application{*selectedApp}, nil
}

func (uc *deleteAppUseCase) deleteAppByID(ctx context.Context, appID string) ([]domain.Application, error) {
	app, err := uc.appService.GetAppByID(ctx, appID)
	if err != nil {
		return nil, NewServiceError("failed to retrieve application by ID", err)
	}

	if err := uc.appService.DeleteApp(ctx, app); err != nil {
		return nil, NewServiceError("failed to delete application", err)
	}

	return []domain.Application{app}, nil
}

func (uc *deleteAppUseCase) deleteAppByName(ctx context.Context, appName string) ([]domain.Application, error) {
	apps, err := uc.appService.GetAllApps(ctx)
	if err != nil {
		return nil, NewServiceError("failed to retrieve applications", err)
	}

	for _, app := range apps {
		if app.Name == appName {
			if err := uc.appService.DeleteApp(ctx, app); err != nil {
				return nil, NewServiceError("failed to delete application", err)
			}
			return []domain.Application{app}, nil
		}
	}

	return nil, NewNotFoundError("application not found by name: "+appName, nil)
}
