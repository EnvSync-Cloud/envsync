package run

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type readConfigUseCase struct {
	syncService services.SyncService
}

func NewReadConfigUseCase() ReadConfigUseCase {
	syncService := services.NewSyncService()
	return &readConfigUseCase{
		syncService: syncService,
	}
}

func (r *readConfigUseCase) Execute(ctx context.Context) (result *domain.SyncConfig, err error) {
	ctx, end := telemetry.StartSpan(ctx, "run.read_config")
	defer end(&err)

	config, err := r.syncService.ReadConfigData()
	if err != nil {
		return nil, err
	}

	return &config, nil
}
