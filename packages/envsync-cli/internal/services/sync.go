package services

import (
	"errors"
	"os"

	"github.com/BurntSushi/toml"
	"github.com/joho/godotenv"

	"github.com/EnvSync-Cloud/envsync-cli/internal/constants"
	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/mappers"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository"
)

type SyncService interface {
	ReadConfigData() (domain.SyncConfig, error)
	WriteConfigData(cfg domain.SyncConfig) error
	SyncConfigExist() error
	ReadLocalEnv() (map[string]string, error)
	ReadRemoteEnv() ([]*domain.EnvironmentVariable, error)
	CalculateEnvDiff(local map[string]string, remote map[string]string) *domain.EnvironmentSync
	WriteLocalEnv(env map[string]string) error
	WriteRemoteEnv(env *domain.EnvironmentSync) error
}

type sync struct {
	repo       repository.EnvVariableRepository
	projectCfg domain.SyncConfig
}

func NewSyncService() SyncService {
	var projCfg domain.SyncConfig
	_ = readTOMLConfig(&projCfg)

	r := repository.NewEnvVariableRepository(projCfg.AppID, projCfg.EnvTypeID)

	return &sync{
		repo:       r,
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
	var cfg domain.SyncConfig

	if err := readTOMLConfig(&cfg); err != nil {
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

func (s *sync) ReadRemoteEnv() ([]*domain.EnvironmentVariable, error) {
	envRes, err := s.repo.GetAllEnv()
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

func (s *sync) WriteRemoteEnv(env *domain.EnvironmentSync) error {
	toCreate := env.ToAdd
	toUpdate := env.ToUpdate
	toDelete := env.ToDelete

	if len(toCreate) != 0 {
		batchCreateReq := mappers.EnvironmentVariableToBatchRequest(toCreate, s.projectCfg.AppID, s.projectCfg.EnvTypeID)
		if err := s.repo.BatchCreateEnv(batchCreateReq); err != nil {
			return err
		}
	}

	if len(toUpdate) != 0 {
		batchUpdateReq := mappers.EnvironmentVariableToBatchRequest(toUpdate, s.projectCfg.AppID, s.projectCfg.EnvTypeID)
		if err := s.repo.BatchUpdateEnv(batchUpdateReq); err != nil {
			return err
		}
	}

	if len(toDelete) != 0 {
		batchDeleteReq := mappers.KeysToBatchDeleteRequest(toDelete, s.projectCfg.AppID, s.projectCfg.EnvTypeID)
		if err := s.repo.BatchDeleteEnv(batchDeleteReq); err != nil {
			return err
		}
	}

	return nil
}

func readTOMLConfig(c *domain.SyncConfig) error {
	if _, err := toml.DecodeFile(constants.DefaultProjectConfig, &c); err != nil {
		return err
	}

	return nil
}
