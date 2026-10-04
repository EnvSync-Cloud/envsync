package app

import (
	"context"
	"os"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/spinner"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/factory"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type deleteAppUseCase struct {
	appService services.ApplicationService
	tui        *factory.AppFactory
}

func NewDeleteAppUseCase(tui *factory.AppFactory) DeleteAppUseCase {
	return &deleteAppUseCase{
		appService: services.NewAppService(),
		tui:        tui,
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

	selected, ok, err := uc.tui.PickApp(apps)
	if err != nil {
		return nil, NewServiceError("failed to select application", err)
	}
	if !ok {
		return nil, NewCancelledError("deletion cancelled by user", nil)
	}

	// Deleting can take a moment; keep a visible status and clear it on the way
	// out so the caller's success output takes its place.
	sp := spinner.New("Deleting application…", spinner.IsTerminal(os.Stderr), os.Stderr)
	sp.Start()
	defer sp.Stop()

	if err := uc.appService.DeleteApp(ctx, selected); err != nil {
		return nil, NewServiceError("failed to delete application", err)
	}

	return []domain.Application{selected}, nil
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
