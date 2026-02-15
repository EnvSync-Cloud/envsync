package run

import (
	"context"
	"os"

	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
)

type injectEnv struct {
	syncService services.SyncService
}

func NewInjectEnv() InjectEnvUseCase {
	s := services.NewSyncService()
	return &injectEnv{
		syncService: s,
	}
}

func (uc *injectEnv) Execute(ctx context.Context) (map[string]string, error) {
	env, err := uc.readRemoteEnv()
	if err != nil {
		//TODO: handle error appropriately
	}

	for key, value := range env {
		if err := os.Setenv(key, value); err != nil {
			// TODO: handle error appropriately
		}
	}

	return env, nil
}

func (uc *injectEnv) readRemoteEnv() (map[string]string, error) {
	remoteEnv, err := uc.syncService.ReadRemoteEnv()
	if err != nil {
		return nil, err
	}

	// Convert remote env variables to map for processing
	remoteEnvMap := make(map[string]string)
	for _, env := range remoteEnv {
		remoteEnvMap[env.Key] = env.Value
	}

	return remoteEnvMap, nil
}
