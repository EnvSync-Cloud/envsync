package run

import (
	"context"
	"errors"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type fetchAppUseCase struct {
	appService services.ApplicationService
}

func NewFetchAppUseCase() FetchAppUseCase {
	appService := services.NewAppService()
	return &fetchAppUseCase{
		appService: appService,
	}
}

func (f *fetchAppUseCase) Execute(ctx context.Context, cfg *domain.SyncConfig) (result *domain.Application, err error) {
	ctx, end := telemetry.StartSpan(ctx, "run.fetch_app")
	defer end(&err)

	if cfg == nil {
		return nil, errors.New("project configuration is required")
	}
	if name := strings.TrimSpace(cfg.AppName); name != "" {
		apps, err := f.appService.GetAllApps(ctx)
		if err != nil {
			return nil, err
		}
		app, err := domain.FindAppByName(apps, name)
		if err != nil {
			return nil, err
		}
		return &app, nil
	}
	if strings.TrimSpace(cfg.AppID) == "" {
		return nil, errors.New("envsyncrc.toml has no app_name")
	}

	app, err := f.appService.GetAppByID(ctx, cfg.AppID)
	if err != nil {
		return nil, err
	}

	return &app, nil
}
