package app

import (
	"context"
	"errors"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/factory"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	tea "github.com/charmbracelet/bubbletea"
)

type deleteAppUseCase struct {
	appService services.ApplicationService
	tui        *factory.AppFactory
}

func NewDeleteAppUseCase() DeleteAppUseCase {
	service := services.NewAppService()
	tui := factory.NewAppFactory()
	return &deleteAppUseCase{
		appService: service,
		tui:        tui,
	}
}

func (uc *deleteAppUseCase) Execute(ctx context.Context) ([]domain.Application, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "app.delete")
	defer span.End()

	// Retrieve application context values with safe type assertions
	appID, _ := ctx.Value("appID").(string)
	appName, _ := ctx.Value("appName").(string)

	var deletedApps []domain.Application
	var err error

	switch {
	case appID == "" && appName == "":
		deletedApps, err = uc.deleteAppsViaUI(ctx)
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

func (uc *deleteAppUseCase) deleteAppsViaUI(ctx context.Context) ([]domain.Application, error) {
	apps, err := uc.findAllApplications(ctx)
	if err != nil {
		return nil, err
	}

	selectedApps, err := uc.tui.DeleteAppsTUI(apps)
	if err != nil {
		if !errors.Is(err, tea.ErrProgramKilled) {
			return nil, NewTUIError("failed to select applications for deletion", err)
		}
		return nil, nil // User cancelled
	}

	for _, app := range selectedApps {
		if err := uc.appService.DeleteApp(ctx, app); err != nil {
			return nil, NewServiceError("failed to delete application", err)
		}
	}

	return selectedApps, nil
}

func (uc *deleteAppUseCase) deleteAppByID(ctx context.Context, appID string) ([]domain.Application, error) {
	app, err := uc.findApplicationByID(ctx, appID)
	if err != nil {
		return nil, err
	}

	if err := uc.deleteApplication(ctx, *app); err != nil {
		return nil, err
	}

	return []domain.Application{*app}, nil
}

func (uc *deleteAppUseCase) deleteAppByName(ctx context.Context, appName string) ([]domain.Application, error) {
	app, err := uc.findApplicationByName(ctx, appName)
	if err != nil {
		return nil, err
	}

	if err := uc.deleteApplication(ctx, *app); err != nil {
		return nil, err
	}

	return []domain.Application{*app}, nil
}

func (uc *deleteAppUseCase) findAllApplications(ctx context.Context) ([]domain.Application, error) {
	// Retrieve all applications from the service
	apps, err := uc.appService.GetAllApps(ctx)
	if err != nil {
		return nil, NewServiceError("failed to retrieve applications", err)
	}
	return apps, nil
}

func (uc *deleteAppUseCase) findApplicationByID(ctx context.Context, appID string) (*domain.Application, error) {
	// Retrieve application by ID from the service
	app, err := uc.appService.GetAppByID(ctx, appID)
	if err != nil {
		return nil, NewServiceError("failed to retrieve application by ID", err)
	}
	return &app, nil
}

func (uc *deleteAppUseCase) findApplicationByName(ctx context.Context, appName string) (*domain.Application, error) {
	// Retrieve application by name from the service
	apps, err := uc.appService.GetAllApps(ctx)
	if err != nil {
		return nil, NewServiceError("failed to retrieve application by name", err)
	}

	for _, app := range apps {
		if app.Name == appName {
			return &app, nil
		}
	}

	return nil, errors.New("application not found by name: " + appName)
}

func (uc *deleteAppUseCase) deleteApplication(ctx context.Context, app domain.Application) error {
	// Delete application via service
	if err := uc.appService.DeleteApp(ctx, app); err != nil {
		return NewServiceError("failed to delete application", err)
	}
	return nil
}
