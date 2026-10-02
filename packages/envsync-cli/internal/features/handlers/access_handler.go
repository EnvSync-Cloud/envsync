package handlers

import (
	"context"
	"fmt"

	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
)

type AccessHandler struct {
	repo      repository.AccessRepository
	formatter *formatters.BaseFormatter
}

func NewAccessHandler() *AccessHandler {
	return &AccessHandler{
		repo:      repository.NewAccessRepository(),
		formatter: formatters.NewBaseFormatter(),
	}
}

func (h *AccessHandler) GrantApp(ctx context.Context, cmd *cli.Command) error {
	if err := h.repo.GrantAppAccess(ctx, cmd.String("app-id"), cmd.String("subject-id"), cmd.String("subject-type"), cmd.String("relation")); err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	return h.formatter.FormatSuccess(cmd.Writer, "App access granted")
}

func (h *AccessHandler) RevokeApp(ctx context.Context, cmd *cli.Command) error {
	if err := h.repo.RevokeAppAccess(ctx, cmd.String("app-id"), cmd.String("subject-id"), cmd.String("subject-type"), cmd.String("relation")); err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	return h.formatter.FormatSuccess(cmd.Writer, "App access revoked")
}

func (h *AccessHandler) GrantsApp(ctx context.Context, cmd *cli.Command) error {
	grants, err := h.repo.ListAppGrants(ctx, cmd.String("app-id"))
	if err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, grants)
	}
	for _, grant := range grants {
		fmt.Fprintf(cmd.Writer, "%s\t%s\t%s\n", grant.SubjectType, grant.SubjectID, grant.Relation)
	}
	return nil
}

func (h *AccessHandler) EffectiveApp(ctx context.Context, cmd *cli.Command) error {
	entries, err := h.repo.EffectiveAppAccess(ctx, cmd.String("app-id"))
	if err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, entries)
	}
	for _, entry := range entries {
		relation := ""
		source := ""
		if entry.Relation != nil {
			relation = *entry.Relation
		}
		if entry.Source != nil {
			source = *entry.Source
		}
		fmt.Fprintf(cmd.Writer, "%s\t%s\t%s\t%v\n", entry.Email, relation, source, entry.Teams)
	}
	return nil
}
