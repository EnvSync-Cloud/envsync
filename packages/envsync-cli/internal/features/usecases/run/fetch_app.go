package run

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
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

func (f *fetchAppUseCase) Execute(ctx context.Context, appID string) (result *domain.Application, err error) {
	ctx, end := telemetry.StartSpan(ctx, "run.fetch_app",
		trace.WithAttributes(attribute.String("app.id", appID)))
	defer end(&err)

	app, err := f.appService.GetAppByID(ctx, appID)
	if err != nil {
		return nil, err
	}

	return &app, nil
}
