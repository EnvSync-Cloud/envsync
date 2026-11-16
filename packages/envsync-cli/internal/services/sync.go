package services

import (
	"context"
	"errors"
	"os"

	"github.com/BurntSushi/toml"
	"github.com/joho/godotenv"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/constants"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/mappers"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type SyncService interface {
	ReadConfigData() (domain.SyncConfig, error)
	ReadConfigDataFromPath(string) (domain.SyncConfig, error)
	WriteConfigData(cfg domain.SyncConfig) error
	SyncConfigExist() error
	ReadLocalEnv() (map[string]string, error)
	ReadRemoteEnv(ctx context.Context) ([]*domain.EnvironmentVariable, error)
	CalculateEnvDiff(local map[string]string, remote map[string]string) *domain.EnvironmentSync
	WriteLocalEnv(env map[string]string) error
	WriteRemoteEnv(ctx context.Context, env *domain.EnvironmentSync) error
}

type sync struct {
	repo       repository.EnvVariableRepository
	projectCfg domain.SyncConfig
}

func NewSyncService() SyncService {
	var projCfg domain.SyncConfig
	_ = readTOMLConfig(&projCfg)

	return NewSyncServiceWithConfig(projCfg)
}

func NewSyncServiceWithConfig(projCfg domain.SyncConfig) SyncService {
	return &sync{
		repo:       repository.NewEnvVariableRepository(projCfg.APIRef()),
		projectCfg: projCfg,
	}
}

func (s *sync) SyncConfigExist() error {
	if _, err := os.Stat(constants.DefaultProjectConfig); errors.Is(err, os.ErrNotExist) {
		return errors.New("project configuration file not found")
	}
	return nil
}

func (s *sync) ReadConfigData() (domain.SyncConfig, error) {
	return s.ReadConfigDataFromPath(constants.DefaultProjectConfig)
}

func (s *sync) ReadConfigDataFromPath(configPath string) (domain.SyncConfig, error) {
	var cfg domain.SyncConfig

	if err := readTOMLConfigFromPath(configPath, &cfg); err != nil {
		return domain.SyncConfig{}, err
	}

	return cfg, nil
}

func (s *sync) WriteConfigData(cfg domain.SyncConfig) error {
	if _, err := os.Stat(constants.DefaultProjectConfig); err != nil {
		if os.IsNotExist(err) {
			os.Create(constants.DefaultProjectConfig)
		}
	}

	// Write the config to the file
	file, err := os.Create(constants.DefaultProjectConfig)
	if err != nil {
		return err
	}
	defer file.Close()

	err = toml.NewEncoder(file).Encode(cfg)
	if err != nil {
		return err
	}

	return nil
}

func (s *sync) ReadRemoteEnv(ctx context.Context) (result []*domain.EnvironmentVariable, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.sync.read_remote_env")
	defer end(&err)

	envRes, err := s.repo.GetAllEnv(ctx)
	if err != nil {
		return nil, err
	}

	envs := mappers.EnvironmentVariablesToDomain(envRes)

	return envs, nil
}

func (s *sync) ReadLocalEnv() (map[string]string, error) {
	if _, err := os.Stat(".env"); os.IsNotExist(err) {
		// Return empty map if .env file doesn't exist
		return make(map[string]string), nil
	}

	return godotenv.Read(".env")
}

func (s *sync) CalculateEnvDiff(local map[string]string, remote map[string]string) *domain.EnvironmentSync {
	// Convert remote map[string]string to map[string]EnvironmentVariable
	remoteVars := make(map[string]domain.EnvironmentVariable)
	for key, value := range remote {
		remoteVars[key] = domain.EnvironmentVariable{
			Key:   key,
			Value: value,
		}
	}

	// Create EnvironmentSync and calculate diff
	envSync := domain.NewEnvironmentSync(local, remoteVars)
	envSync.CalculateDiff()

	return envSync
}

func (s *sync) WriteLocalEnv(env map[string]string) error {
	return godotenv.Write(env, ".env")
}

func (s *sync) WriteRemoteEnv(ctx context.Context, env *domain.EnvironmentSync) (err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.sync.write_remote_env")
	defer end(&err)

	toCreate := env.ToAdd
	toUpdate := env.ToUpdate
	toDelete := env.ToDelete

	ref := s.projectCfg.APIRef()
	if len(toCreate) != 0 {
		batchCreateReq := mappers.EnvironmentVariableToBatchRequest(toCreate, ref)
		if err := s.repo.BatchCreateEnv(ctx, batchCreateReq); err != nil {
			return err
		}
	}

	if len(toUpdate) != 0 {
		batchUpdateReq := mappers.EnvironmentVariableToBatchRequest(toUpdate, ref)
		if err := s.repo.BatchUpdateEnv(ctx, batchUpdateReq); err != nil {
			return err
		}
	}

	if len(toDelete) != 0 {
		batchDeleteReq := mappers.KeysToBatchDeleteRequest(toDelete, ref)
		if err := s.repo.BatchDeleteEnv(ctx, batchDeleteReq); err != nil {
			return err
		}
	}

	return nil
}

func readTOMLConfig(c *domain.SyncConfig) error {
	return readTOMLConfigFromPath(constants.DefaultProjectConfig, c)
}

func readTOMLConfigFromPath(path string, c *domain.SyncConfig) error {
	if path == "" {
		path = constants.DefaultProjectConfig
	}

	if _, err := toml.DecodeFile(path, c); err != nil {
		return err
	}

	return nil
}
