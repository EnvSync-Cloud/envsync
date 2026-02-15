package run

import (
	"context"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
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

func (r *readConfigUseCase) Execute(ctx context.Context) (*domain.SyncConfig, error) {
	config, err := r.syncService.ReadConfigData()
	if err != nil {
		return nil, err
	}

	return &config, nil
}
