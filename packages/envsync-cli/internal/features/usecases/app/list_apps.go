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

func (uc *listAppsUseCase) Execute(ctx context.Context) ([]domain.Application, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "app.list")
	defer span.End()

	apps, err := uc.appService.GetAllApps(ctx)
	if err != nil {
		return nil, NewServiceError("failed to retrieve applications", err)
	}

	return apps, nil
}
