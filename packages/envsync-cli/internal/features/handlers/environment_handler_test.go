package handlers

import (
	"bytes"
	"context"
	"errors"
	"flag"
	"testing"

	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
)

type mockGetEnvUseCase struct {
	byAppID func(ctx context.Context, appID string) ([]domain.EnvType, error)
}

func (m *mockGetEnvUseCase) ExecuteByAppID(ctx context.Context, appID string) ([]domain.EnvType, error) {
	if m.byAppID != nil {
		return m.byAppID(ctx, appID)
	}
	return nil, nil
}

func (m *mockGetEnvUseCase) ExecuteByID(context.Context, string) (domain.EnvType, error) {
	return domain.EnvType{}, errors.New("not used in these tests")
}

type mockSwitchEnvUseCase struct{}

func (m *mockSwitchEnvUseCase) Execute(context.Context, domain.EnvType) error {
	return errors.New("not used in these tests")
}

type mockDeleteEnvUseCase struct{}

func (m *mockDeleteEnvUseCase) Execute(context.Context, string) error {
	return errors.New("not used in these tests")
}

func newTestEnvironmentCommand(handler *EnvironmentHandler, args []string) *cli.Command {
	cmd := &cli.Command{
		Name: "envsync",
		Flags: []cli.Flag{
			&cli.BoolFlag{Name: "json"},
		},
		Commands: []*cli.Command{
			{
				Name:   "environment",
				Action: handler.GetAllEnvironments,
				Flags: []cli.Flag{
					&cli.StringFlag{Name: "app-id"},
				},
			},
		},
	}
	// urfave/cli v3 uses flag sets; set args on the root for Run.
	_ = flag.CommandLine
	return cmd
}

func runGetAllEnvironments(t *testing.T, handler *EnvironmentHandler, args []string) (stdout string, err error) {
	t.Helper()

	var out bytes.Buffer
	cmd := &cli.Command{
		Name:   "list",
		Writer: &out,
		Flags: []cli.Flag{
			&cli.StringFlag{Name: "app-id"},
			&cli.BoolFlag{Name: "json"},
		},
		Action: handler.GetAllEnvironments,
	}

	err = cmd.Run(context.Background(), append([]string{"list"}, args...))
	return out.String(), err
}

func TestGetAllEnvironments_ListsEnvironments(t *testing.T) {
	handler := NewEnvironmentHandler(
		&mockGetEnvUseCase{
			byAppID: func(_ context.Context, appID string) ([]domain.EnvType, error) {
				if appID != "app-123" {
					t.Fatalf("expected app-123, got %q", appID)
				}
				return []domain.EnvType{
					{ID: "env-1", Name: "Development", IsDefault: true, Color: "green"},
					{ID: "env-2", Name: "Production", IsProtected: true, Color: "red"},
				}, nil
			},
		},
		&mockSwitchEnvUseCase{},
		&mockDeleteEnvUseCase{},
		formatters.NewEnvFormatter(),
	)

	out, err := runGetAllEnvironments(t, handler, []string{"--app-id", "app-123"})
	if err != nil {
		t.Fatalf("GetAllEnvironments returned error: %v\noutput: %s", err, out)
	}
	if !bytesContains(out, "Development") || !bytesContains(out, "Production") || !bytesContains(out, "env-1") {
		t.Fatalf("unexpected table output:\n%s", out)
	}
}

func TestGetAllEnvironments_JSON(t *testing.T) {
	handler := NewEnvironmentHandler(
		&mockGetEnvUseCase{
			byAppID: func(context.Context, string) ([]domain.EnvType, error) {
				return []domain.EnvType{
					{ID: "env-1", Name: "Development", IsDefault: true},
				}, nil
			},
		},
		&mockSwitchEnvUseCase{},
		&mockDeleteEnvUseCase{},
		formatters.NewEnvFormatter(),
	)

	out, err := runGetAllEnvironments(t, handler, []string{"--app-id", "app-123", "--json"})
	if err != nil {
		t.Fatalf("GetAllEnvironments returned error: %v\noutput: %s", err, out)
	}
	if !bytesContains(out, `"ID"`) && !bytesContains(out, `"id"`) {
		// domain.EnvType uses exported fields → JSON keys are ID/Name unless tagged.
		if !bytesContains(out, "env-1") || !bytesContains(out, "Development") {
			t.Fatalf("unexpected json output:\n%s", out)
		}
	}
	if !bytesContains(out, "env-1") || !bytesContains(out, "Development") {
		t.Fatalf("unexpected json output:\n%s", out)
	}
}

func TestGetAllEnvironments_MissingAppID(t *testing.T) {
	handler := NewEnvironmentHandler(
		&mockGetEnvUseCase{},
		&mockSwitchEnvUseCase{},
		&mockDeleteEnvUseCase{},
		formatters.NewEnvFormatter(),
	)

	out, err := runGetAllEnvironments(t, handler, nil)
	// formatUseCaseError returns a formatter error as the result, not always nil.
	if err == nil && out == "" {
		t.Fatal("expected validation error for missing app-id")
	}
	if !bytesContains(out, "app-id") && (err == nil || !bytesContains(err.Error(), "app-id")) {
		t.Fatalf("expected app-id validation message, out=%q err=%v", out, err)
	}
}

func TestGetAllEnvironments_UseCaseError(t *testing.T) {
	handler := NewEnvironmentHandler(
		&mockGetEnvUseCase{
			byAppID: func(context.Context, string) ([]domain.EnvType, error) {
				return nil, errors.New("backend unavailable")
			},
		},
		&mockSwitchEnvUseCase{},
		&mockDeleteEnvUseCase{},
		formatters.NewEnvFormatter(),
	)

	out, err := runGetAllEnvironments(t, handler, []string{"--app-id", "app-123"})
	if err == nil && out == "" {
		t.Fatal("expected error when use case fails")
	}
	combined := out
	if err != nil {
		combined += err.Error()
	}
	if !bytesContains(combined, "backend unavailable") && !bytesContains(combined, "Unexpected error") {
		t.Fatalf("expected use case error to surface, got out=%q err=%v", out, err)
	}
}

func TestGetAllEnvironments_DoesNotPanic(t *testing.T) {
	handler := NewEnvironmentHandler(
		&mockGetEnvUseCase{
			byAppID: func(context.Context, string) ([]domain.EnvType, error) {
				return []domain.EnvType{}, nil
			},
		},
		&mockSwitchEnvUseCase{},
		&mockDeleteEnvUseCase{},
		formatters.NewEnvFormatter(),
	)

	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("GetAllEnvironments panicked: %v", r)
		}
	}()

	out, err := runGetAllEnvironments(t, handler, []string{"--app-id", "app-123"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !bytesContains(out, "No environments found") {
		t.Fatalf("expected empty-state message, got: %s", out)
	}
}

func bytesContains(s, substr string) bool {
	return bytes.Contains([]byte(s), []byte(substr))
}
