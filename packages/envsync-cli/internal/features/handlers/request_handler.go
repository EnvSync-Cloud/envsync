package handlers

import (
	"context"
	"fmt"

	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
)

type RequestHandler struct {
	repo      repository.ChangeRequestRepository
	formatter *formatters.BaseFormatter
}

func NewRequestHandler() *RequestHandler {
	return &RequestHandler{
		repo:      repository.NewChangeRequestRepository(),
		formatter: formatters.NewBaseFormatter(),
	}
}

func (h *RequestHandler) CreateDirect(ctx context.Context, cmd *cli.Command) error {
	payload := map[string]any{
		"app_id":             cmd.String("app-id"),
		"target_env_type_id": cmd.String("target-env-type-id"),
		"title":              cmd.String("title"),
		"message":            cmd.String("message"),
	}
	if key := cmd.String("env-key"); key != "" {
		payload["envs"] = []map[string]any{{
			"key":            key,
			"operation":      cmd.String("env-operation"),
			"proposed_value": cmd.String("env-value"),
		}}
	}
	if key := cmd.String("secret-key"); key != "" {
		payload["secrets"] = []map[string]any{{
			"key":            key,
			"operation":      cmd.String("secret-operation"),
			"proposed_value": cmd.String("secret-value"),
		}}
	}
	result, err := h.repo.CreateDirect(ctx, payload)
	if err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, result)
	}
	return h.formatter.FormatSuccess(cmd.Writer, "Change request created: "+result.ID)
}

func (h *RequestHandler) CreatePromotion(ctx context.Context, cmd *cli.Command) error {
	result, err := h.repo.CreatePromotion(ctx, map[string]any{
		"app_id":             cmd.String("app-id"),
		"source_env_type_id": cmd.String("source-env-type-id"),
		"target_env_type_id": cmd.String("target-env-type-id"),
		"title":              cmd.String("title"),
		"message":            cmd.String("message"),
	})
	if err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, result)
	}
	return h.formatter.FormatSuccess(cmd.Writer, "Promotion request created: "+result.ID)
}

func (h *RequestHandler) List(ctx context.Context, cmd *cli.Command) error {
	items, err := h.repo.List(ctx)
	if err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, items)
	}
	for _, item := range items {
		fmt.Fprintf(cmd.Writer, "%s\t%s\t%s\t%s\t%s\n", item.ID, item.RequestKind, item.Status, item.AppID, item.Title)
	}
	return nil
}

func (h *RequestHandler) Get(ctx context.Context, cmd *cli.Command) error {
	item, err := h.repo.Get(ctx, cmd.String("id"))
	if err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, item)
	}
	return h.formatter.FormatSuccess(cmd.Writer, fmt.Sprintf("Request %s: %s (%s)", item.ID, item.Title, item.Status))
}

func (h *RequestHandler) Approve(ctx context.Context, cmd *cli.Command) error {
	item, err := h.repo.Approve(ctx, cmd.String("id"))
	if err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, item)
	}
	return h.formatter.FormatSuccess(cmd.Writer, "Change request approved: "+item.ID)
}

func (h *RequestHandler) Reject(ctx context.Context, cmd *cli.Command) error {
	item, err := h.repo.Reject(ctx, cmd.String("id"), cmd.String("reason"))
	if err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, item)
	}
	return h.formatter.FormatSuccess(cmd.Writer, "Change request rejected: "+item.ID)
}

func (h *RequestHandler) Cancel(ctx context.Context, cmd *cli.Command) error {
	item, err := h.repo.Cancel(ctx, cmd.String("id"))
	if err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, item)
	}
	return h.formatter.FormatSuccess(cmd.Writer, "Change request cancelled: "+item.ID)
}
