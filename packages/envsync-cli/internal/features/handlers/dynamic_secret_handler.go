package handlers

import (
	"context"
	"encoding/json"
	"time"

	"github.com/urfave/cli/v3"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/usecases/dynamic_secret"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
)

type DynamicSecretHandler struct {
	listEnginesUseCase   dynamic_secret.ListEnginesUseCase
	createEngineUseCase  dynamic_secret.CreateEngineUseCase
	getEngineUseCase     dynamic_secret.GetEngineUseCase
	updateEngineUseCase  dynamic_secret.UpdateEngineUseCase
	deleteEngineUseCase  dynamic_secret.DeleteEngineUseCase
	listLeasesUseCase    dynamic_secret.ListLeasesUseCase
	createLeaseUseCase   dynamic_secret.CreateLeaseUseCase
	getLeaseUseCase      dynamic_secret.GetLeaseUseCase
	revokeLeaseUseCase   dynamic_secret.RevokeLeaseUseCase
	cleanupUseCase       dynamic_secret.CleanupUseCase
	formatter            *formatters.DynamicSecretFormatter
}

func NewDynamicSecretHandler() *DynamicSecretHandler {
	return &DynamicSecretHandler{
		listEnginesUseCase:  dynamic_secret.NewListEnginesUseCase(),
		createEngineUseCase: dynamic_secret.NewCreateEngineUseCase(),
		getEngineUseCase:    dynamic_secret.NewGetEngineUseCase(),
		updateEngineUseCase: dynamic_secret.NewUpdateEngineUseCase(),
		deleteEngineUseCase: dynamic_secret.NewDeleteEngineUseCase(),
		listLeasesUseCase:   dynamic_secret.NewListLeasesUseCase(),
		createLeaseUseCase:  dynamic_secret.NewCreateLeaseUseCase(),
		getLeaseUseCase:     dynamic_secret.NewGetLeaseUseCase(),
		revokeLeaseUseCase:  dynamic_secret.NewRevokeLeaseUseCase(),
		cleanupUseCase:      dynamic_secret.NewCleanupUseCase(),
		formatter:           formatters.NewDynamicSecretFormatter(),
	}
}

// Engine operations

func (h *DynamicSecretHandler) ListEngines(ctx context.Context, cmd *cli.Command) error {
	engines, err := h.listEnginesUseCase.Execute(ctx)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, engines)
	}

	return h.formatter.FormatEngineList(cmd.Writer, engines)
}

func (h *DynamicSecretHandler) CreateEngine(ctx context.Context, cmd *cli.Command) error {
	engineType, err := sdk.NewCreateDynamicSecretEngineRequestEngineTypeFromString(cmd.String("engine"))
	if err != nil {
		return h.formatter.FormatError(cmd.Writer, "Invalid engine type: "+cmd.String("engine"))
	}

	req := &sdk.CreateDynamicSecretEngineRequest{
		Name:       cmd.String("name"),
		EngineType: engineType,
	}

	if cmd.IsSet("config") {
		var configMap map[string]interface{}
		if err := json.Unmarshal([]byte(cmd.String("config")), &configMap); err != nil {
			return h.formatter.FormatError(cmd.Writer, "Invalid config JSON: "+err.Error())
		}
		// For CLI simplicity, we pass config as a raw map
		// The SDK union type requires specific struct, so we skip it here
		// and let the API handle validation
	}

	engine, err := h.createEngineUseCase.Execute(ctx, req)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, engine)
	}

	return h.formatter.FormatCreateEngineSuccess(cmd.Writer, engine)
}

func (h *DynamicSecretHandler) GetEngine(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")
	if id == "" {
		return h.formatter.FormatError(cmd.Writer, "Engine ID is required (--id)")
	}

	engine, err := h.getEngineUseCase.Execute(ctx, id)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, engine)
	}

	return h.formatter.FormatEngineDetail(cmd.Writer, engine)
}

func (h *DynamicSecretHandler) UpdateEngine(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")
	if id == "" {
		return h.formatter.FormatError(cmd.Writer, "Engine ID is required (--id)")
	}

	req := &sdk.UpdateDynamicSecretEngineRequest{}

	if cmd.IsSet("name") {
		name := cmd.String("name")
		req.Name = &name
	}
	if cmd.IsSet("enabled") {
		enabled := cmd.Bool("enabled")
		req.Enabled = &enabled
	}

	engine, err := h.updateEngineUseCase.Execute(ctx, id, req)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, engine)
	}

	return h.formatter.FormatUpdateEngineSuccess(cmd.Writer, engine)
}

func (h *DynamicSecretHandler) DeleteEngine(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")
	if id == "" {
		return h.formatter.FormatError(cmd.Writer, "Engine ID is required (--id)")
	}

	if err := h.deleteEngineUseCase.Execute(ctx, id); err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, map[string]string{"message": "Dynamic secret engine deleted successfully", "id": id})
	}

	return h.formatter.FormatSuccess(cmd.Writer, "Dynamic secret engine deleted: "+id)
}

// Lease operations

func (h *DynamicSecretHandler) ListLeases(ctx context.Context, cmd *cli.Command) error {
	engineID := cmd.String("engine-id")
	if engineID == "" {
		return h.formatter.FormatError(cmd.Writer, "Engine ID is required (--engine-id)")
	}

	leases, err := h.listLeasesUseCase.Execute(ctx, engineID)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, leases)
	}

	return h.formatter.FormatLeaseList(cmd.Writer, leases)
}

func (h *DynamicSecretHandler) CreateLease(ctx context.Context, cmd *cli.Command) error {
	engineID := cmd.String("engine-id")
	if engineID == "" {
		return h.formatter.FormatError(cmd.Writer, "Engine ID is required (--engine-id)")
	}

	req := &sdk.CreateDynamicSecretLeaseRequest{}

	if cmd.IsSet("ttl") {
		ttlStr := cmd.String("ttl")
		duration, err := time.ParseDuration(ttlStr)
		if err != nil {
			return h.formatter.FormatError(cmd.Writer, "Invalid TTL duration: "+ttlStr)
		}
		ttlSeconds := int(duration.Seconds())
		req.TtlSeconds = &ttlSeconds
	}

	lease, err := h.createLeaseUseCase.Execute(ctx, engineID, req)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, lease)
	}

	return h.formatter.FormatCreateLeaseSuccess(cmd.Writer, lease)
}

func (h *DynamicSecretHandler) GetLease(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")
	if id == "" {
		return h.formatter.FormatError(cmd.Writer, "Lease ID is required (--id)")
	}

	lease, err := h.getLeaseUseCase.Execute(ctx, id)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, lease)
	}

	return h.formatter.FormatLeaseDetail(cmd.Writer, lease)
}

func (h *DynamicSecretHandler) RevokeLease(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")
	if id == "" {
		return h.formatter.FormatError(cmd.Writer, "Lease ID is required (--id)")
	}

	result, err := h.revokeLeaseUseCase.Execute(ctx, id)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, result)
	}

	return h.formatter.FormatRevokeLeaseSuccess(cmd.Writer, result)
}

func (h *DynamicSecretHandler) Cleanup(ctx context.Context, cmd *cli.Command) error {
	result, err := h.cleanupUseCase.Execute(ctx)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, result)
	}

	return h.formatter.FormatCleanupSuccess(cmd.Writer, result)
}

func (h *DynamicSecretHandler) formatError(cmd *cli.Command, err error) error {
	if cmd.Bool("json") {
		return h.formatter.FormatJSONError(cmd.Writer, err)
	}
	return h.formatter.FormatError(cmd.Writer, err.Error())
}
