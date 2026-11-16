package app

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type listAppsUseCase struct {
	appService services.ApplicationService
}

func NewListAppsUseCase() ListAppsUseCase {
	service := services.NewAppService()
	return &listAppsUseCase{
		appService: service,
	}
}

func (uc *listAppsUseCase) Execute(ctx context.Context) (result []domain.Application, err error) {
	ctx, end := telemetry.StartSpan(ctx, "app.list")
	defer end(&err)

	apps, err := uc.appService.GetAllApps(ctx)
	if err != nil {
		return nil, NewServiceError("failed to retrieve applications", err)
	}

	return apps, nil
}
