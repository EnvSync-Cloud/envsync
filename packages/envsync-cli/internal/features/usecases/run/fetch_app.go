package run

import (
	"context"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
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

func (f *fetchAppUseCase) Execute(ctx context.Context, appID string) (*domain.Application, error) {
	app, err := f.appService.GetAppByID(appID)
	if err != nil {
		return nil, err
	}

	return &app, nil
}
