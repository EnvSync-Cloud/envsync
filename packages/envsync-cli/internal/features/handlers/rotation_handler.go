package handlers

import (
	"context"
	"encoding/json"

	"github.com/urfave/cli/v3"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/usecases/rotation"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
)

type RotationHandler struct {
	listUseCase     rotation.ListPoliciesUseCase
	createUseCase   rotation.CreatePolicyUseCase
	getUseCase      rotation.GetPolicyUseCase
	updateUseCase   rotation.UpdatePolicyUseCase
	deleteUseCase   rotation.DeletePolicyUseCase
	triggerUseCase  rotation.TriggerRotationUseCase
	statesUseCase   rotation.GetRotationStatesUseCase
	revokeUseCase   rotation.RevokeExpiredCredentialsUseCase
	formatter       *formatters.RotationFormatter
}

func NewRotationHandler() *RotationHandler {
	return &RotationHandler{
		listUseCase:    rotation.NewListPoliciesUseCase(),
		createUseCase:  rotation.NewCreatePolicyUseCase(),
		getUseCase:     rotation.NewGetPolicyUseCase(),
		updateUseCase:  rotation.NewUpdatePolicyUseCase(),
		deleteUseCase:  rotation.NewDeletePolicyUseCase(),
		triggerUseCase: rotation.NewTriggerRotationUseCase(),
		statesUseCase:  rotation.NewGetRotationStatesUseCase(),
		revokeUseCase:  rotation.NewRevokeExpiredCredentialsUseCase(),
		formatter:      formatters.NewRotationFormatter(),
	}
}

func (h *RotationHandler) List(ctx context.Context, cmd *cli.Command) error {
	req := &sdk.GetRotationPoliciesRequest{}

	policies, err := h.listUseCase.Execute(ctx, req)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, policies)
	}

	return h.formatter.FormatPolicyList(cmd.Writer, policies)
}

func (h *RotationHandler) Create(ctx context.Context, cmd *cli.Command) error {
	engineType, err := sdk.NewCreateRotationPolicyRequestEngineTypeFromString(cmd.String("engine"))
	if err != nil {
		return h.formatter.FormatError(cmd.Writer, "Invalid engine type: "+cmd.String("engine"))
	}

	req := &sdk.CreateRotationPolicyRequest{
		EngineType:   engineType,
		ScheduleCron: cmd.String("schedule"),
	}

	if cmd.IsSet("name") {
		// name maps to variable_key for display purposes
		req.VariableKey = cmd.String("name")
	}
	if cmd.IsSet("secret-id") {
		// secret-id is a composite: app_id/env_type_id/variable_key
		// For simplicity, we treat it as app_id
		req.AppId = cmd.String("secret-id")
	}
	if cmd.IsSet("config") {
		var configMap map[string]interface{}
		if err := json.Unmarshal([]byte(cmd.String("config")), &configMap); err != nil {
			return h.formatter.FormatError(cmd.Writer, "Invalid config JSON: "+err.Error())
		}
		req.ConnectionConfig = configMap
	}

	policy, err := h.createUseCase.Execute(ctx, req)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, policy)
	}

	return h.formatter.FormatCreateSuccess(cmd.Writer, policy)
}

func (h *RotationHandler) Get(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")
	if id == "" {
		return h.formatter.FormatError(cmd.Writer, "Rotation policy ID is required (--id)")
	}

	policy, err := h.getUseCase.Execute(ctx, id)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, policy)
	}

	return h.formatter.FormatPolicyDetail(cmd.Writer, policy)
}

func (h *RotationHandler) Update(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")
	if id == "" {
		return h.formatter.FormatError(cmd.Writer, "Rotation policy ID is required (--id)")
	}

	req := &sdk.UpdateRotationPolicyRequest{}

	if cmd.IsSet("schedule") {
		schedule := cmd.String("schedule")
		req.ScheduleCron = &schedule
	}
	if cmd.IsSet("enabled") {
		enabled := cmd.Bool("enabled")
		req.Enabled = &enabled
	}
	if cmd.IsSet("config") {
		var configMap map[string]interface{}
		if err := json.Unmarshal([]byte(cmd.String("config")), &configMap); err != nil {
			return h.formatter.FormatError(cmd.Writer, "Invalid config JSON: "+err.Error())
		}
		req.ConnectionConfig = configMap
	}

	policy, err := h.updateUseCase.Execute(ctx, id, req)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, policy)
	}

	return h.formatter.FormatUpdateSuccess(cmd.Writer, policy)
}

func (h *RotationHandler) Delete(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")
	if id == "" {
		return h.formatter.FormatError(cmd.Writer, "Rotation policy ID is required (--id)")
	}

	if err := h.deleteUseCase.Execute(ctx, id); err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, map[string]string{"message": "Rotation policy deleted successfully", "id": id})
	}

	return h.formatter.FormatSuccess(cmd.Writer, "Rotation policy deleted: "+id)
}

func (h *RotationHandler) Trigger(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")
	if id == "" {
		return h.formatter.FormatError(cmd.Writer, "Rotation policy ID is required (--id)")
	}

	result, err := h.triggerUseCase.Execute(ctx, id)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, result)
	}

	return h.formatter.FormatTriggerSuccess(cmd.Writer, result)
}

func (h *RotationHandler) States(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")
	if id == "" {
		return h.formatter.FormatError(cmd.Writer, "Rotation policy ID is required (--id)")
	}

	states, err := h.statesUseCase.Execute(ctx, id)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, states)
	}

	return h.formatter.FormatStatesList(cmd.Writer, states)
}

func (h *RotationHandler) RevokeExpired(ctx context.Context, cmd *cli.Command) error {
	result, err := h.revokeUseCase.Execute(ctx)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, result)
	}

	return h.formatter.FormatRevokeSuccess(cmd.Writer, result)
}

func (h *RotationHandler) formatError(cmd *cli.Command, err error) error {
	if cmd.Bool("json") {
		return h.formatter.FormatJSONError(cmd.Writer, err)
	}
	return h.formatter.FormatError(cmd.Writer, err.Error())
}
