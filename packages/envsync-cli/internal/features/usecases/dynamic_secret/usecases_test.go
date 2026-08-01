package dynamic_secret

import (
	"context"
	"errors"
	"testing"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
)

// mockDynamicSecretService implements services.DynamicSecretService for testing.
type mockDynamicSecretService struct {
	listEnginesFn         func(ctx context.Context) (sdk.DynamicSecretEnginesResponse, error)
	createEngineFn        func(ctx context.Context, req *sdk.CreateDynamicSecretEngineRequest) (*sdk.DynamicSecretEngineResponse, error)
	getEngineFn           func(ctx context.Context, id string) (*sdk.DynamicSecretEngineResponse, error)
	deleteEngineFn        func(ctx context.Context, id string) (*sdk.ErrorResponse, error)
	updateEngineFn        func(ctx context.Context, id string, req *sdk.UpdateDynamicSecretEngineRequest) (*sdk.DynamicSecretEngineResponse, error)
	listLeasesFn          func(ctx context.Context, engineID string) (sdk.DynamicSecretLeasesResponse, error)
	createLeaseFn         func(ctx context.Context, engineID string, req *sdk.CreateDynamicSecretLeaseRequest) (*sdk.DynamicSecretLeaseResponse, error)
	getLeaseFn            func(ctx context.Context, leaseID string) (*sdk.DynamicSecretLeaseResponse, error)
	revokeLeaseFn         func(ctx context.Context, leaseID string) (*sdk.RevokeLeaseResponse, error)
	cleanupExpiredLeasesFn func(ctx context.Context) (*sdk.CleanupResponse, error)
}

func (m *mockDynamicSecretService) ListEngines(ctx context.Context) (sdk.DynamicSecretEnginesResponse, error) {
	return m.listEnginesFn(ctx)
}

func (m *mockDynamicSecretService) CreateEngine(ctx context.Context, req *sdk.CreateDynamicSecretEngineRequest) (*sdk.DynamicSecretEngineResponse, error) {
	return m.createEngineFn(ctx, req)
}

func (m *mockDynamicSecretService) GetEngine(ctx context.Context, id string) (*sdk.DynamicSecretEngineResponse, error) {
	return m.getEngineFn(ctx, id)
}

func (m *mockDynamicSecretService) DeleteEngine(ctx context.Context, id string) (*sdk.ErrorResponse, error) {
	return m.deleteEngineFn(ctx, id)
}

func (m *mockDynamicSecretService) UpdateEngine(ctx context.Context, id string, req *sdk.UpdateDynamicSecretEngineRequest) (*sdk.DynamicSecretEngineResponse, error) {
	return m.updateEngineFn(ctx, id, req)
}

func (m *mockDynamicSecretService) ListLeases(ctx context.Context, engineID string) (sdk.DynamicSecretLeasesResponse, error) {
	return m.listLeasesFn(ctx, engineID)
}

func (m *mockDynamicSecretService) CreateLease(ctx context.Context, engineID string, req *sdk.CreateDynamicSecretLeaseRequest) (*sdk.DynamicSecretLeaseResponse, error) {
	return m.createLeaseFn(ctx, engineID, req)
}

func (m *mockDynamicSecretService) GetLease(ctx context.Context, leaseID string) (*sdk.DynamicSecretLeaseResponse, error) {
	return m.getLeaseFn(ctx, leaseID)
}

func (m *mockDynamicSecretService) RevokeLease(ctx context.Context, leaseID string) (*sdk.RevokeLeaseResponse, error) {
	return m.revokeLeaseFn(ctx, leaseID)
}

func (m *mockDynamicSecretService) CleanupExpiredLeases(ctx context.Context) (*sdk.CleanupResponse, error) {
	return m.cleanupExpiredLeasesFn(ctx)
}

var errService = errors.New("service error")

// --- CreateEngineUseCase ---

func TestCreateEngineUseCase_Execute(t *testing.T) {
	validReq := &sdk.CreateDynamicSecretEngineRequest{
		Name:       "my-postgres-engine",
		EngineType: sdk.CreateDynamicSecretEngineRequestEngineTypePostgres,
	}

	expectedResp := &sdk.DynamicSecretEngineResponse{
		Id:         "engine-123",
		Name:       "my-postgres-engine",
		EngineType: sdk.DynamicSecretEngineResponseEngineTypePostgres,
		Enabled:    true,
	}

	tests := []struct {
		name        string
		req         *sdk.CreateDynamicSecretEngineRequest
		mockFn      func(ctx context.Context, req *sdk.CreateDynamicSecretEngineRequest) (*sdk.DynamicSecretEngineResponse, error)
		wantErr     bool
		wantErrCode string
		checkResp   func(t *testing.T, resp *sdk.DynamicSecretEngineResponse)
	}{
		{
			name: "success",
			req:  validReq,
			mockFn: func(_ context.Context, _ *sdk.CreateDynamicSecretEngineRequest) (*sdk.DynamicSecretEngineResponse, error) {
				return expectedResp, nil
			},
			wantErr: false,
			checkResp: func(t *testing.T, resp *sdk.DynamicSecretEngineResponse) {
				if resp.Id != "engine-123" {
					t.Errorf("expected engine ID 'engine-123', got '%s'", resp.Id)
				}
				if resp.Name != "my-postgres-engine" {
					t.Errorf("expected name 'my-postgres-engine', got '%s'", resp.Name)
				}
			},
		},
		{
			name: "empty name returns validation error",
			req: &sdk.CreateDynamicSecretEngineRequest{
				Name:       "",
				EngineType: sdk.CreateDynamicSecretEngineRequestEngineTypePostgres,
			},
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: DynamicSecretErrorCodeValidation,
		},
		{
			name: "empty engine_type returns validation error",
			req: &sdk.CreateDynamicSecretEngineRequest{
				Name:       "my-engine",
				EngineType: "",
			},
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: DynamicSecretErrorCodeValidation,
		},
		{
			name: "service error returns service error",
			req:  validReq,
			mockFn: func(_ context.Context, _ *sdk.CreateDynamicSecretEngineRequest) (*sdk.DynamicSecretEngineResponse, error) {
				return nil, errService
			},
			wantErr:     true,
			wantErrCode: DynamicSecretErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &createEngineUseCase{
				dynamicSecretService: &mockDynamicSecretService{
					createEngineFn: tt.mockFn,
				},
			}

			resp, err := uc.Execute(context.Background(), tt.req)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var dsErr *DynamicSecretError
				if !errors.As(err, &dsErr) {
					t.Fatalf("expected *DynamicSecretError, got %T", err)
				}
				if dsErr.Code != tt.wantErrCode {
					t.Errorf("expected error code '%s', got '%s'", tt.wantErrCode, dsErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if resp == nil {
				t.Fatal("expected non-nil response")
			}
			if tt.checkResp != nil {
				tt.checkResp(t, resp)
			}
		})
	}
}

// --- ListEnginesUseCase ---

func TestListEnginesUseCase_Execute(t *testing.T) {
	expectedEngines := sdk.DynamicSecretEnginesResponse{
		&sdk.DynamicSecretEngineResponse{Id: "e1", Name: "engine-1"},
		&sdk.DynamicSecretEngineResponse{Id: "e2", Name: "engine-2"},
	}

	tests := []struct {
		name      string
		mockFn    func(ctx context.Context) (sdk.DynamicSecretEnginesResponse, error)
		wantErr   bool
		wantCount int
	}{
		{
			name: "success with results",
			mockFn: func(_ context.Context) (sdk.DynamicSecretEnginesResponse, error) {
				return expectedEngines, nil
			},
			wantErr:   false,
			wantCount: 2,
		},
		{
			name: "success with empty list",
			mockFn: func(_ context.Context) (sdk.DynamicSecretEnginesResponse, error) {
				return sdk.DynamicSecretEnginesResponse{}, nil
			},
			wantErr:   false,
			wantCount: 0,
		},
		{
			name: "service error",
			mockFn: func(_ context.Context) (sdk.DynamicSecretEnginesResponse, error) {
				return nil, errService
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &listEnginesUseCase{
				dynamicSecretService: &mockDynamicSecretService{
					listEnginesFn: tt.mockFn,
				},
			}

			resp, err := uc.Execute(context.Background())

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var dsErr *DynamicSecretError
				if !errors.As(err, &dsErr) {
					t.Fatalf("expected *DynamicSecretError, got %T", err)
				}
				if dsErr.Code != DynamicSecretErrorCodeServiceError {
					t.Errorf("expected error code '%s', got '%s'", DynamicSecretErrorCodeServiceError, dsErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(resp) != tt.wantCount {
				t.Errorf("expected %d engines, got %d", tt.wantCount, len(resp))
			}
		})
	}
}

// --- GetEngineUseCase ---

func TestGetEngineUseCase_Execute(t *testing.T) {
	expectedEngine := &sdk.DynamicSecretEngineResponse{
		Id:   "engine-123",
		Name: "my-engine",
	}

	tests := []struct {
		name        string
		id          string
		mockFn      func(ctx context.Context, id string) (*sdk.DynamicSecretEngineResponse, error)
		wantErr     bool
		wantErrCode string
	}{
		{
			name: "success",
			id:   "engine-123",
			mockFn: func(_ context.Context, id string) (*sdk.DynamicSecretEngineResponse, error) {
				if id != "engine-123" {
					t.Errorf("expected ID 'engine-123', got '%s'", id)
				}
				return expectedEngine, nil
			},
			wantErr: false,
		},
		{
			name:        "empty ID returns validation error",
			id:          "",
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: DynamicSecretErrorCodeValidation,
		},
		{
			name: "service error returns service error",
			id:   "engine-123",
			mockFn: func(_ context.Context, _ string) (*sdk.DynamicSecretEngineResponse, error) {
				return nil, errService
			},
			wantErr:     true,
			wantErrCode: DynamicSecretErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &getEngineUseCase{
				dynamicSecretService: &mockDynamicSecretService{
					getEngineFn: tt.mockFn,
				},
			}

			resp, err := uc.Execute(context.Background(), tt.id)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var dsErr *DynamicSecretError
				if !errors.As(err, &dsErr) {
					t.Fatalf("expected *DynamicSecretError, got %T", err)
				}
				if dsErr.Code != tt.wantErrCode {
					t.Errorf("expected error code '%s', got '%s'", tt.wantErrCode, dsErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if resp == nil {
				t.Fatal("expected non-nil response")
			}
			if resp.Id != "engine-123" {
				t.Errorf("expected engine ID 'engine-123', got '%s'", resp.Id)
			}
		})
	}
}

// --- UpdateEngineUseCase ---

func TestUpdateEngineUseCase_Execute(t *testing.T) {
	newName := "updated-engine"
	updateReq := &sdk.UpdateDynamicSecretEngineRequest{
		Name: &newName,
	}

	expectedEngine := &sdk.DynamicSecretEngineResponse{
		Id:   "engine-123",
		Name: "updated-engine",
	}

	tests := []struct {
		name        string
		id          string
		req         *sdk.UpdateDynamicSecretEngineRequest
		mockFn      func(ctx context.Context, id string, req *sdk.UpdateDynamicSecretEngineRequest) (*sdk.DynamicSecretEngineResponse, error)
		wantErr     bool
		wantErrCode string
	}{
		{
			name: "success",
			id:   "engine-123",
			req:  updateReq,
			mockFn: func(_ context.Context, id string, _ *sdk.UpdateDynamicSecretEngineRequest) (*sdk.DynamicSecretEngineResponse, error) {
				if id != "engine-123" {
					t.Errorf("expected ID 'engine-123', got '%s'", id)
				}
				return expectedEngine, nil
			},
			wantErr: false,
		},
		{
			name:        "empty ID returns validation error",
			id:          "",
			req:         updateReq,
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: DynamicSecretErrorCodeValidation,
		},
		{
			name: "service error returns service error",
			id:   "engine-123",
			req:  updateReq,
			mockFn: func(_ context.Context, _ string, _ *sdk.UpdateDynamicSecretEngineRequest) (*sdk.DynamicSecretEngineResponse, error) {
				return nil, errService
			},
			wantErr:     true,
			wantErrCode: DynamicSecretErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &updateEngineUseCase{
				dynamicSecretService: &mockDynamicSecretService{
					updateEngineFn: tt.mockFn,
				},
			}

			resp, err := uc.Execute(context.Background(), tt.id, tt.req)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var dsErr *DynamicSecretError
				if !errors.As(err, &dsErr) {
					t.Fatalf("expected *DynamicSecretError, got %T", err)
				}
				if dsErr.Code != tt.wantErrCode {
					t.Errorf("expected error code '%s', got '%s'", tt.wantErrCode, dsErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if resp == nil {
				t.Fatal("expected non-nil response")
			}
		})
	}
}

// --- DeleteEngineUseCase ---

func TestDeleteEngineUseCase_Execute(t *testing.T) {
	tests := []struct {
		name        string
		id          string
		mockFn      func(ctx context.Context, id string) (*sdk.ErrorResponse, error)
		wantErr     bool
		wantErrCode string
	}{
		{
			name: "success",
			id:   "engine-123",
			mockFn: func(_ context.Context, id string) (*sdk.ErrorResponse, error) {
				if id != "engine-123" {
					t.Errorf("expected ID 'engine-123', got '%s'", id)
				}
				return nil, nil
			},
			wantErr: false,
		},
		{
			name:        "empty ID returns validation error",
			id:          "",
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: DynamicSecretErrorCodeValidation,
		},
		{
			name: "service error returns service error",
			id:   "engine-123",
			mockFn: func(_ context.Context, _ string) (*sdk.ErrorResponse, error) {
				return nil, errService
			},
			wantErr:     true,
			wantErrCode: DynamicSecretErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &deleteEngineUseCase{
				dynamicSecretService: &mockDynamicSecretService{
					deleteEngineFn: tt.mockFn,
				},
			}

			err := uc.Execute(context.Background(), tt.id)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var dsErr *DynamicSecretError
				if !errors.As(err, &dsErr) {
					t.Fatalf("expected *DynamicSecretError, got %T", err)
				}
				if dsErr.Code != tt.wantErrCode {
					t.Errorf("expected error code '%s', got '%s'", tt.wantErrCode, dsErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

// --- CreateLeaseUseCase ---

func TestCreateLeaseUseCase_Execute(t *testing.T) {
	validReq := &sdk.CreateDynamicSecretLeaseRequest{
		AppId:       "app-123",
		EnvTypeId:   "env-456",
		VariableKey: "DB_CREDS",
	}

	expectedLease := &sdk.DynamicSecretLeaseResponse{
		Id:          "lease-789",
		EngineId:    "engine-123",
		AppId:       "app-123",
		EnvTypeId:   "env-456",
		VariableKey: "DB_CREDS",
	}

	tests := []struct {
		name        string
		engineID    string
		req         *sdk.CreateDynamicSecretLeaseRequest
		mockFn      func(ctx context.Context, engineID string, req *sdk.CreateDynamicSecretLeaseRequest) (*sdk.DynamicSecretLeaseResponse, error)
		wantErr     bool
		wantErrCode string
	}{
		{
			name:     "success",
			engineID: "engine-123",
			req:      validReq,
			mockFn: func(_ context.Context, engineID string, _ *sdk.CreateDynamicSecretLeaseRequest) (*sdk.DynamicSecretLeaseResponse, error) {
				if engineID != "engine-123" {
					t.Errorf("expected engine ID 'engine-123', got '%s'", engineID)
				}
				return expectedLease, nil
			},
			wantErr: false,
		},
		{
			name:        "empty engine ID returns validation error",
			engineID:    "",
			req:         validReq,
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: DynamicSecretErrorCodeValidation,
		},
		{
			name:     "service error returns service error",
			engineID: "engine-123",
			req:      validReq,
			mockFn: func(_ context.Context, _ string, _ *sdk.CreateDynamicSecretLeaseRequest) (*sdk.DynamicSecretLeaseResponse, error) {
				return nil, errService
			},
			wantErr:     true,
			wantErrCode: DynamicSecretErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &createLeaseUseCase{
				dynamicSecretService: &mockDynamicSecretService{
					createLeaseFn: tt.mockFn,
				},
			}

			resp, err := uc.Execute(context.Background(), tt.engineID, tt.req)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var dsErr *DynamicSecretError
				if !errors.As(err, &dsErr) {
					t.Fatalf("expected *DynamicSecretError, got %T", err)
				}
				if dsErr.Code != tt.wantErrCode {
					t.Errorf("expected error code '%s', got '%s'", tt.wantErrCode, dsErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if resp == nil {
				t.Fatal("expected non-nil response")
			}
			if resp.Id != "lease-789" {
				t.Errorf("expected lease ID 'lease-789', got '%s'", resp.Id)
			}
		})
	}
}

// --- ListLeasesUseCase ---

func TestListLeasesUseCase_Execute(t *testing.T) {
	expectedLeases := sdk.DynamicSecretLeasesResponse{
		&sdk.DynamicSecretLeaseResponse{Id: "l1", EngineId: "engine-123"},
		&sdk.DynamicSecretLeaseResponse{Id: "l2", EngineId: "engine-123"},
	}

	tests := []struct {
		name        string
		engineID    string
		mockFn      func(ctx context.Context, engineID string) (sdk.DynamicSecretLeasesResponse, error)
		wantErr     bool
		wantErrCode string
		wantCount   int
	}{
		{
			name:     "success with results",
			engineID: "engine-123",
			mockFn: func(_ context.Context, engineID string) (sdk.DynamicSecretLeasesResponse, error) {
				if engineID != "engine-123" {
					t.Errorf("expected engine ID 'engine-123', got '%s'", engineID)
				}
				return expectedLeases, nil
			},
			wantErr:   false,
			wantCount: 2,
		},
		{
			name:     "success with empty list",
			engineID: "engine-123",
			mockFn: func(_ context.Context, _ string) (sdk.DynamicSecretLeasesResponse, error) {
				return sdk.DynamicSecretLeasesResponse{}, nil
			},
			wantErr:   false,
			wantCount: 0,
		},
		{
			name:        "empty engine ID returns validation error",
			engineID:    "",
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: DynamicSecretErrorCodeValidation,
		},
		{
			name:     "service error returns service error",
			engineID: "engine-123",
			mockFn: func(_ context.Context, _ string) (sdk.DynamicSecretLeasesResponse, error) {
				return nil, errService
			},
			wantErr:     true,
			wantErrCode: DynamicSecretErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &listLeasesUseCase{
				dynamicSecretService: &mockDynamicSecretService{
					listLeasesFn: tt.mockFn,
				},
			}

			resp, err := uc.Execute(context.Background(), tt.engineID)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var dsErr *DynamicSecretError
				if !errors.As(err, &dsErr) {
					t.Fatalf("expected *DynamicSecretError, got %T", err)
				}
				if dsErr.Code != tt.wantErrCode {
					t.Errorf("expected error code '%s', got '%s'", tt.wantErrCode, dsErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(resp) != tt.wantCount {
				t.Errorf("expected %d leases, got %d", tt.wantCount, len(resp))
			}
		})
	}
}

// --- GetLeaseUseCase ---

func TestGetLeaseUseCase_Execute(t *testing.T) {
	expectedLease := &sdk.DynamicSecretLeaseResponse{
		Id:       "lease-123",
		EngineId: "engine-456",
	}

	tests := []struct {
		name        string
		leaseID     string
		mockFn      func(ctx context.Context, leaseID string) (*sdk.DynamicSecretLeaseResponse, error)
		wantErr     bool
		wantErrCode string
	}{
		{
			name:    "success",
			leaseID: "lease-123",
			mockFn: func(_ context.Context, leaseID string) (*sdk.DynamicSecretLeaseResponse, error) {
				if leaseID != "lease-123" {
					t.Errorf("expected lease ID 'lease-123', got '%s'", leaseID)
				}
				return expectedLease, nil
			},
			wantErr: false,
		},
		{
			name:        "empty lease ID returns validation error",
			leaseID:     "",
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: DynamicSecretErrorCodeValidation,
		},
		{
			name:    "service error returns service error",
			leaseID: "lease-123",
			mockFn: func(_ context.Context, _ string) (*sdk.DynamicSecretLeaseResponse, error) {
				return nil, errService
			},
			wantErr:     true,
			wantErrCode: DynamicSecretErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &getLeaseUseCase{
				dynamicSecretService: &mockDynamicSecretService{
					getLeaseFn: tt.mockFn,
				},
			}

			resp, err := uc.Execute(context.Background(), tt.leaseID)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var dsErr *DynamicSecretError
				if !errors.As(err, &dsErr) {
					t.Fatalf("expected *DynamicSecretError, got %T", err)
				}
				if dsErr.Code != tt.wantErrCode {
					t.Errorf("expected error code '%s', got '%s'", tt.wantErrCode, dsErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if resp == nil {
				t.Fatal("expected non-nil response")
			}
			if resp.Id != "lease-123" {
				t.Errorf("expected lease ID 'lease-123', got '%s'", resp.Id)
			}
		})
	}
}

// --- RevokeLeaseUseCase ---

func TestRevokeLeaseUseCase_Execute(t *testing.T) {
	expectedResp := &sdk.RevokeLeaseResponse{
		Message: "lease revoked",
		Id:      "lease-123",
	}

	tests := []struct {
		name        string
		leaseID     string
		mockFn      func(ctx context.Context, leaseID string) (*sdk.RevokeLeaseResponse, error)
		wantErr     bool
		wantErrCode string
	}{
		{
			name:    "success",
			leaseID: "lease-123",
			mockFn: func(_ context.Context, leaseID string) (*sdk.RevokeLeaseResponse, error) {
				if leaseID != "lease-123" {
					t.Errorf("expected lease ID 'lease-123', got '%s'", leaseID)
				}
				return expectedResp, nil
			},
			wantErr: false,
		},
		{
			name:        "empty lease ID returns validation error",
			leaseID:     "",
			mockFn:      nil,
			wantErr:     true,
			wantErrCode: DynamicSecretErrorCodeValidation,
		},
		{
			name:    "service error returns service error",
			leaseID: "lease-123",
			mockFn: func(_ context.Context, _ string) (*sdk.RevokeLeaseResponse, error) {
				return nil, errService
			},
			wantErr:     true,
			wantErrCode: DynamicSecretErrorCodeServiceError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &revokeLeaseUseCase{
				dynamicSecretService: &mockDynamicSecretService{
					revokeLeaseFn: tt.mockFn,
				},
			}

			resp, err := uc.Execute(context.Background(), tt.leaseID)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var dsErr *DynamicSecretError
				if !errors.As(err, &dsErr) {
					t.Fatalf("expected *DynamicSecretError, got %T", err)
				}
				if dsErr.Code != tt.wantErrCode {
					t.Errorf("expected error code '%s', got '%s'", tt.wantErrCode, dsErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if resp == nil {
				t.Fatal("expected non-nil response")
			}
			if resp.Message != "lease revoked" {
				t.Errorf("expected message 'lease revoked', got '%s'", resp.Message)
			}
		})
	}
}

// --- CleanupUseCase ---

func TestCleanupUseCase_Execute(t *testing.T) {
	expectedResp := &sdk.CleanupResponse{
		Cleaned: 5,
	}

	tests := []struct {
		name    string
		mockFn  func(ctx context.Context) (*sdk.CleanupResponse, error)
		wantErr bool
	}{
		{
			name: "success",
			mockFn: func(_ context.Context) (*sdk.CleanupResponse, error) {
				return expectedResp, nil
			},
			wantErr: false,
		},
		{
			name: "service error",
			mockFn: func(_ context.Context) (*sdk.CleanupResponse, error) {
				return nil, errService
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := &cleanupUseCase{
				dynamicSecretService: &mockDynamicSecretService{
					cleanupExpiredLeasesFn: tt.mockFn,
				},
			}

			resp, err := uc.Execute(context.Background())

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var dsErr *DynamicSecretError
				if !errors.As(err, &dsErr) {
					t.Fatalf("expected *DynamicSecretError, got %T", err)
				}
				if dsErr.Code != DynamicSecretErrorCodeServiceError {
					t.Errorf("expected error code '%s', got '%s'", DynamicSecretErrorCodeServiceError, dsErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if resp == nil {
				t.Fatal("expected non-nil response")
			}
			if resp.Cleaned != 5 {
				t.Errorf("expected cleaned count 5, got %d", resp.Cleaned)
			}
		})
	}
}

// --- Error type tests ---

func TestDynamicSecretError_Error(t *testing.T) {
	tests := []struct {
		name     string
		err      *DynamicSecretError
		expected string
	}{
		{
			name: "with cause",
			err: &DynamicSecretError{
				Code:    DynamicSecretErrorCodeServiceError,
				Message: "operation failed",
				Cause:   errors.New("underlying error"),
			},
			expected: "operation failed: underlying error",
		},
		{
			name: "without cause",
			err: &DynamicSecretError{
				Code:    DynamicSecretErrorCodeValidation,
				Message: "validation failed",
			},
			expected: "validation failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.err.Error() != tt.expected {
				t.Errorf("expected '%s', got '%s'", tt.expected, tt.err.Error())
			}
		})
	}
}

func TestDynamicSecretError_Unwrap(t *testing.T) {
	cause := errors.New("root cause")
	dsErr := &DynamicSecretError{
		Code:    DynamicSecretErrorCodeServiceError,
		Message: "wrapped",
		Cause:   cause,
	}

	if !errors.Is(dsErr, cause) {
		t.Error("expected Unwrap to return the cause error")
	}
}

func TestDynamicSecretNewValidationError(t *testing.T) {
	cause := errors.New("bad input")
	err := NewValidationError("validation failed", cause)

	if err.Code != DynamicSecretErrorCodeValidation {
		t.Errorf("expected code '%s', got '%s'", DynamicSecretErrorCodeValidation, err.Code)
	}
	if err.Message != "validation failed" {
		t.Errorf("expected message 'validation failed', got '%s'", err.Message)
	}
	if !errors.Is(err, cause) {
		t.Error("expected error to wrap the cause")
	}
}

func TestDynamicSecretNewNotFoundError(t *testing.T) {
	cause := errors.New("not found")
	err := NewNotFoundError("resource missing", cause)

	if err.Code != DynamicSecretErrorCodeNotFound {
		t.Errorf("expected code '%s', got '%s'", DynamicSecretErrorCodeNotFound, err.Code)
	}
	if !errors.Is(err, cause) {
		t.Error("expected error to wrap the cause")
	}
}

func TestDynamicSecretNewServiceError(t *testing.T) {
	cause := errors.New("internal")
	err := NewServiceError("service down", cause)

	if err.Code != DynamicSecretErrorCodeServiceError {
		t.Errorf("expected code '%s', got '%s'", DynamicSecretErrorCodeServiceError, err.Code)
	}
	if !errors.Is(err, cause) {
		t.Error("expected error to wrap the cause")
	}
}

// --- Sentinel error tests ---

func TestSentinelErrors(t *testing.T) {
	sentinels := []struct {
		name string
		err  error
	}{
		{"ErrIDRequired", ErrIDRequired},
		{"ErrEngineIDRequired", ErrEngineIDRequired},
		{"ErrNameRequired", ErrNameRequired},
		{"ErrEngineTypeRequired", ErrEngineTypeRequired},
		{"ErrConfigRequired", ErrConfigRequired},
		{"ErrEngineNotFound", ErrEngineNotFound},
		{"ErrLeaseNotFound", ErrLeaseNotFound},
		{"ErrFailedToList", ErrFailedToList},
		{"ErrFailedToCreate", ErrFailedToCreate},
		{"ErrFailedToGet", ErrFailedToGet},
		{"ErrFailedToUpdate", ErrFailedToUpdate},
		{"ErrFailedToDelete", ErrFailedToDelete},
		{"ErrFailedToListLeases", ErrFailedToListLeases},
		{"ErrFailedToCreateLease", ErrFailedToCreateLease},
		{"ErrFailedToGetLease", ErrFailedToGetLease},
		{"ErrFailedToRevokeLease", ErrFailedToRevokeLease},
		{"ErrFailedToCleanup", ErrFailedToCleanup},
	}

	for _, tt := range sentinels {
		t.Run(tt.name, func(t *testing.T) {
			if tt.err == nil {
				t.Errorf("sentinel error %s is nil", tt.name)
			}
			if tt.err.Error() == "" {
				t.Errorf("sentinel error %s has empty message", tt.name)
			}
		})
	}
}
