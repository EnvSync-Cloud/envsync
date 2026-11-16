package services

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/mappers"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type ApplicationService interface {
	CreateApp(ctx context.Context, app *domain.Application) (domain.Application, error)
	GetAppByID(ctx context.Context, id string) (domain.Application, error)
	GetAllApps(ctx context.Context) ([]domain.Application, error)
	DeleteApp(ctx context.Context, app domain.Application) error
}

type app struct {
	appRepo     repository.ApplicationRepository
	envTypeRepo repository.EnvTypeRepository
}

func NewAppService() ApplicationService {
	appRepo := repository.NewApplicationRepository()
	envTypeRepo := repository.NewEnvTypeRepository()

	return &app{
		appRepo:     appRepo,
		envTypeRepo: envTypeRepo,
	}
}

func (a *app) CreateApp(ctx context.Context, app *domain.Application) (result domain.Application, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.app.create_app")
	defer end(&err)

	req := mappers.DomainToAppRequest(app)

	var appRes domain.Application
	if res, err := a.appRepo.Create(ctx, req); err != nil {
		return domain.Application{}, err
	} else {
		appRes = mappers.AppResponseToDomain(res)
	}

	return appRes, nil
}

func (a *app) GetAllApps(ctx context.Context) (result []domain.Application, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.app.get_all_apps")
	defer end(&err)

	res, err := a.appRepo.GetAll(ctx)
	if err != nil {
		return nil, err
	}

	var apps []domain.Application
	for _, appResp := range res {
		apps = append(apps, mappers.AppResponseToDomain(appResp))
	}

	return apps, nil
}

func (a *app) DeleteApp(ctx context.Context, app domain.Application) (err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.app.delete_app")
	defer end(&err)

	if err := a.appRepo.Delete(ctx, app.ID); err != nil {
		return err
	}

	return nil
}

func (a *app) GetAppByID(ctx context.Context, id string) (result domain.Application, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.app.get_app_by_id")
	defer end(&err)

	res, err := a.appRepo.GetByID(ctx, id)
	if err != nil {
		return domain.Application{}, err
	}

	app := mappers.AppResponseToDomain(res)
	return app, nil
}
