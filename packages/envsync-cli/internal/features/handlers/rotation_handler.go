package handlers

import (
	"context"

	"github.com/urfave/cli/v3"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/usecases/rotation"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
)

type RotationHandler struct {
	listUseCase    rotation.ListPoliciesUseCase
	getUseCase     rotation.GetPolicyUseCase
	triggerUseCase rotation.TriggerRotationUseCase
	statesUseCase  rotation.GetRotationStatesUseCase
	revokeUseCase  rotation.RevokeExpiredCredentialsUseCase
	formatter      *formatters.RotationFormatter
}

func NewRotationHandler() *RotationHandler {
	return &RotationHandler{
		listUseCase:    rotation.NewListPoliciesUseCase(),
		getUseCase:     rotation.NewGetPolicyUseCase(),
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

func (h *RotationHandler) Get(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")
	if id == "" {
		return h.formatter.FormatError(cmd.ErrWriter, "Rotation policy ID is required (--id)")
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

func (h *RotationHandler) Trigger(ctx context.Context, cmd *cli.Command) error {
	id := cmd.String("id")
	if id == "" {
		return h.formatter.FormatError(cmd.ErrWriter, "Rotation policy ID is required (--id)")
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
		return h.formatter.FormatError(cmd.ErrWriter, "Rotation policy ID is required (--id)")
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
	return h.formatter.FormatError(cmd.ErrWriter, err.Error())
}
