package environment

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
)

// mockEnvTypeService is a test double implementing services.EnvTypeService.
type mockEnvTypeService struct {
	getByAppIDFn func(ctx context.Context, appID string) ([]domain.EnvType, error)
	getByIDFn    func(ctx context.Context, id string) (domain.EnvType, error)
}

var _ services.EnvTypeService = (*mockEnvTypeService)(nil)

func (m *mockEnvTypeService) CreateEnvType(ctx context.Context, envType *domain.EnvType) (domain.EnvType, error) {
	return domain.EnvType{}, nil
}

func (m *mockEnvTypeService) GetEnvTypeByID(ctx context.Context, id string) (domain.EnvType, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, id)
	}
	return domain.EnvType{}, nil
}

func (m *mockEnvTypeService) GetEnvTypesByAppID(ctx context.Context, appID string) ([]domain.EnvType, error) {
	if m.getByAppIDFn != nil {
		return m.getByAppIDFn(ctx, appID)
	}
	return nil, nil
}

func (m *mockEnvTypeService) DeleteEnvType(ctx context.Context, id string) error {
	return nil
}

// mockSyncService is a test double implementing services.SyncService. Only the
// project-config accessors matter for app ID resolution; the rest are inert.
type mockSyncService struct {
	configExistErr error
	config         domain.SyncConfig
	configReadErr  error
	configReads    int
}

var _ services.SyncService = (*mockSyncService)(nil)

func (m *mockSyncService) ReadConfigData() (domain.SyncConfig, error) {
	m.configReads++
	return m.config, m.configReadErr
}

func (m *mockSyncService) ReadConfigDataFromPath(string) (domain.SyncConfig, error) {
	return m.config, m.configReadErr
}

func (m *mockSyncService) WriteConfigData(cfg domain.SyncConfig) error {
	return nil
}

func (m *mockSyncService) SyncConfigExist() error {
	return m.configExistErr
}

func (m *mockSyncService) ReadLocalEnv() (map[string]string, error) { return nil, nil }

func (m *mockSyncService) ReadRemoteEnv(ctx context.Context) ([]*domain.EnvironmentVariable, error) {
	return nil, nil
}

func (m *mockSyncService) CalculateEnvDiff(local map[string]string, remote map[string]string) *domain.EnvironmentSync {
	return nil
}

func (m *mockSyncService) WriteLocalEnv(env map[string]string) error { return nil }

func (m *mockSyncService) WriteRemoteEnv(ctx context.Context, env *domain.EnvironmentSync) error {
	return nil
}

func TestExecuteByAppID_ExplicitIDWins(t *testing.T) {
	syncSvc := &mockSyncService{}
	var gotAppID string
	uc := &getEnvUseCase{
		envService: &mockEnvTypeService{
			getByAppIDFn: func(ctx context.Context, appID string) ([]domain.EnvType, error) {
				gotAppID = appID
				return []domain.EnvType{{ID: "env-1"}}, nil
			},
		},
		syncService: syncSvc,
	}

	envs, err := uc.ExecuteByAppID(context.Background(), "app-explicit")
	if err != nil {
		t.Fatalf("ExecuteByAppID() error = %v", err)
	}
	if gotAppID != "app-explicit" {
		t.Fatalf("service called with appID %q, want %q", gotAppID, "app-explicit")
	}
	if len(envs) != 1 {
		t.Fatalf("got %d envs, want 1", len(envs))
	}
	if syncSvc.configReads != 0 {
		t.Fatalf("config read %d times for explicit app ID, want 0", syncSvc.configReads)
	}
}

func TestExecuteByAppID_FallsBackToProjectConfig(t *testing.T) {
	var gotAppID string
	uc := &getEnvUseCase{
		envService: &mockEnvTypeService{
			getByAppIDFn: func(ctx context.Context, appID string) ([]domain.EnvType, error) {
				gotAppID = appID
				return nil, nil
			},
		},
		syncService: &mockSyncService{config: domain.SyncConfig{AppID: "app-from-config"}},
	}

	if _, err := uc.ExecuteByAppID(context.Background(), ""); err != nil {
		t.Fatalf("ExecuteByAppID() error = %v", err)
	}
	if gotAppID != "app-from-config" {
		t.Fatalf("service called with appID %q, want %q", gotAppID, "app-from-config")
	}
}

func TestExecuteByAppID_MissingConfigFile(t *testing.T) {
	uc := &getEnvUseCase{
		envService:  &mockEnvTypeService{},
		syncService: &mockSyncService{configExistErr: errors.New("project configuration file not found")},
	}

	_, err := uc.ExecuteByAppID(context.Background(), "")
	if err == nil {
		t.Fatal("ExecuteByAppID() error = nil, want error")
	}
	var envErr *EnvError
	if !errors.As(err, &envErr) {
		t.Fatalf("error type = %T, want *EnvError", err)
	}
	if envErr.Code != EnvErrorCodeValidation {
		t.Fatalf("error code = %q, want %q", envErr.Code, EnvErrorCodeValidation)
	}
	if !strings.Contains(err.Error(), "--app-id") {
		t.Fatalf("error %q should tell the user about --app-id", err)
	}
}

func TestExecuteByAppID_ConfigWithoutAppID(t *testing.T) {
	uc := &getEnvUseCase{
		envService:  &mockEnvTypeService{},
		syncService: &mockSyncService{config: domain.SyncConfig{}},
	}

	_, err := uc.ExecuteByAppID(context.Background(), "")
	if err == nil {
		t.Fatal("ExecuteByAppID() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "--app-id") {
		t.Fatalf("error %q should tell the user about --app-id", err)
	}
}

func TestExecuteByAppID_ServiceError(t *testing.T) {
	uc := &getEnvUseCase{
		envService: &mockEnvTypeService{
			getByAppIDFn: func(ctx context.Context, appID string) ([]domain.EnvType, error) {
				return nil, errors.New("boom")
			},
		},
		syncService: &mockSyncService{},
	}

	_, err := uc.ExecuteByAppID(context.Background(), "app-1")
	if err == nil {
		t.Fatal("ExecuteByAppID() error = nil, want error")
	}
	var envErr *EnvError
	if !errors.As(err, &envErr) {
		t.Fatalf("error type = %T, want *EnvError", err)
	}
	if envErr.Code != EnvErrorCodeServiceError {
		t.Fatalf("error code = %q, want %q", envErr.Code, EnvErrorCodeServiceError)
	}
}
