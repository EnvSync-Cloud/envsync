package environment

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type getEnvUseCase struct {
	envService  services.EnvTypeService
	syncService services.SyncService
}

func NewGetEnvUseCase() GetEnvUseCase {
	return &getEnvUseCase{
		envService:  services.NewEnvTypeService(),
		syncService: services.NewSyncService(),
	}
}

func (uc *getEnvUseCase) ExecuteByAppID(ctx context.Context, appID string) (result []domain.EnvType, err error) {
	ctx, end := telemetry.StartSpan(ctx, "environment.get_by_app_id",
		trace.WithAttributes(attribute.String("app.id", appID)))
	defer end(&err)

	appID, err = uc.resolveAppID(appID)
	if err != nil {
		return nil, err
	}

	envTypes, err := uc.envService.GetEnvTypesByAppID(ctx, appID)
	if err != nil {
		return nil, NewServiceError("failed to get environment by app ID", err)
	}
	return envTypes, nil
}

// resolveAppID honours an explicit app ID and otherwise falls back to the
// app_id written to ./envsyncrc.toml by `envsync init`. Without either, the
// user gets pointed at --app-id instead of a cryptic fetch failure.
func (uc *getEnvUseCase) resolveAppID(appID string) (string, error) {
	if appID != "" {
		return appID, nil
	}

	if err := uc.syncService.SyncConfigExist(); err != nil {
		return "", NewValidationError(
			"no app ID given and no envsyncrc.toml in the current directory; provide the application ID with the --app-id flag",
			"",
			nil,
		)
	}

	cfg, err := uc.syncService.ReadConfigData()
	if err != nil {
		return "", NewFileSystemError("failed to read envsyncrc.toml", err)
	}
	if cfg.AppID == "" {
		return "", NewValidationError(
			"envsyncrc.toml in the current directory has no app_id; provide the application ID with the --app-id flag",
			"",
			nil,
		)
	}
	return cfg.AppID, nil
}

func (uc *getEnvUseCase) ExecuteByID(ctx context.Context, id string) (result domain.EnvType, err error) {
	ctx, end := telemetry.StartSpan(ctx, "environment.get_by_id",
		trace.WithAttributes(attribute.String("env.id", id)))
	defer end(&err)

	env, err := uc.envService.GetEnvTypeByID(ctx, id)
	if err != nil {
		return domain.EnvType{}, NewServiceError("failed to get environment by ID", err)
	}
	return env, nil
}
