package sync

import (
	"context"
	"fmt"
	"os"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
	"github.com/joho/godotenv"
)

type pullUseCase struct {
	syncService services.SyncService
}

func NewPullUseCase() PullUseCase {
	service := services.NewSyncService()
	return &pullUseCase{
		syncService: service,
	}
}

func (uc *pullUseCase) Execute(ctx context.Context, configPath string) (SyncResponse, error) {
	// Check if the configuration file exists
	if err := uc.checkConfigFileExists(configPath); err != nil {
		return SyncResponse{}, NewFileSystemError("configuration file check failed", err)
	}

	// Read remote remote environment variables
	remoteEnv, err := uc.syncService.ReadRemoteEnv()
	if err != nil {
		return SyncResponse{}, NewServiceError("failed to read remote environment variables", err)
	}

	// Convert remote env variables to map for processing
	remoteEnvMap := make(map[string]string)
	for _, env := range remoteEnv {
		remoteEnvMap[env.Key] = env.Value
	}

	// Read local environment variables from the specified config file
	localEnv, err := uc.syncService.ReadLocalEnv()
	if err != nil {
		return SyncResponse{}, NewFileSystemError("failed to read local environment variables", err)
	}

	// Calculate the differences between remote and local environment variables
	diff, err := uc.calculateEnvDiff(remoteEnvMap, localEnv)
	if err != nil {
		return SyncResponse{}, NewValidationError("failed to calculate environment differences", "", err)
	}

	if len(diff.Added) > 0 || len(diff.Updated) > 0 || len(diff.Deleted) > 0 {
		err := uc.writeToLocalEnv(remoteEnvMap)
		if err != nil {
			return SyncResponse{}, NewFileSystemError("failed to write updated environment variables to local file", err)
		}
	}

	return diff, nil
}

func (uc *pullUseCase) checkConfigFileExists(configPath string) error {
	// Check if the configuration file exists at the specified path
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return fmt.Errorf("configuration file does not exist at path: %s", configPath)
	}

	return nil
}

func (uc *pullUseCase) calculateEnvDiff(remoteEnv, localEnv map[string]string) (SyncResponse, error) {
	added := make([]domain.EnvironmentVariable, 0)
	updated := make([]domain.EnvironmentVariable, 0)
	deleted := make([]domain.EnvironmentVariable, 0)
	conflicts := make([]domain.EnvironmentVariable, 0)
	warnings := make([]string, 0)

	// Track keys in local for deletion detection
	localKeys := make(map[string]struct{}, len(localEnv))
	for k := range localEnv {
		localKeys[k] = struct{}{}
	}

	// Check for added and updated/conflicted keys (from remote to local)
	for k, remoteVal := range remoteEnv {
		if localVal, ok := localEnv[k]; !ok {
			added = append(added, domain.EnvironmentVariable{Key: k, Value: remoteVal})
		} else if localVal != remoteVal {
			updated = append(updated, domain.EnvironmentVariable{Key: k, Value: remoteVal})
			conflicts = append(conflicts, domain.EnvironmentVariable{Key: k, Value: remoteVal})
			warnings = append(warnings, "Conflict for key '"+k+"': local='"+localVal+"' remote='"+remoteVal+"'")
		}
		delete(localKeys, k)
	}

	// Remaining keys in localKeys are deleted in remote (should be deleted from local)
	for k := range localKeys {
		deleted = append(deleted, domain.EnvironmentVariable{Key: k, Value: localEnv[k]})
	}

	return SyncResponse{
		Added:     added,
		Updated:   updated,
		Deleted:   deleted,
		Conflicts: conflicts,
		Warnings:  warnings,
	}, nil
}

func (uc *pullUseCase) writeToLocalEnv(env map[string]string) error {
	return godotenv.Write(env, ".env")
}
