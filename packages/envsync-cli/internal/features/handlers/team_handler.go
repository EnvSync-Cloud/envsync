package handlers

import (
	"context"
	"fmt"

	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
)

type TeamHandler struct {
	repo      repository.TeamRepository
	formatter *formatters.BaseFormatter
}

func NewTeamHandler() *TeamHandler {
	return &TeamHandler{
		repo:      repository.NewTeamRepository(),
		formatter: formatters.NewBaseFormatter(),
	}
}

func (h *TeamHandler) List(ctx context.Context, cmd *cli.Command) error {
	teams, err := h.repo.List(ctx)
	if err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, teams)
	}
	for _, team := range teams {
		roleID := "none"
		if team.RoleID != nil {
			roleID = *team.RoleID
		}
		fmt.Fprintf(cmd.Writer, "%s\t%s\t%s\t%s\n", team.ID, team.Name, roleID, team.Color)
	}
	return nil
}

func (h *TeamHandler) Create(ctx context.Context, cmd *cli.Command) error {
	team, err := h.repo.Create(ctx, map[string]any{
		"name":        cmd.String("name"),
		"description": cmd.String("description"),
		"color":       cmd.String("color"),
	})
	if err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, team)
	}
	return h.formatter.FormatSuccess(cmd.Writer, "Team created: "+team.ID)
}

func (h *TeamHandler) Update(ctx context.Context, cmd *cli.Command) error {
	payload := map[string]any{}
	if cmd.IsSet("name") {
		payload["name"] = cmd.String("name")
	}
	if cmd.IsSet("description") {
		payload["description"] = cmd.String("description")
	}
	if cmd.IsSet("color") {
		payload["color"] = cmd.String("color")
	}
	if err := h.repo.Update(ctx, cmd.String("id"), payload); err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	return h.formatter.FormatSuccess(cmd.Writer, "Team updated: "+cmd.String("id"))
}

func (h *TeamHandler) Delete(ctx context.Context, cmd *cli.Command) error {
	if err := h.repo.Delete(ctx, cmd.String("id")); err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	return h.formatter.FormatSuccess(cmd.Writer, "Team deleted: "+cmd.String("id"))
}

func (h *TeamHandler) AddMember(ctx context.Context, cmd *cli.Command) error {
	if err := h.repo.AddMember(ctx, cmd.String("id"), cmd.String("user-id")); err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	return h.formatter.FormatSuccess(cmd.Writer, "Member added to team")
}

func (h *TeamHandler) RemoveMember(ctx context.Context, cmd *cli.Command) error {
	if err := h.repo.RemoveMember(ctx, cmd.String("id"), cmd.String("user-id")); err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	return h.formatter.FormatSuccess(cmd.Writer, "Member removed from team")
}

func (h *TeamHandler) AssignRole(ctx context.Context, cmd *cli.Command) error {
	if err := h.repo.AssignRole(ctx, cmd.String("id"), cmd.String("role-id")); err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	return h.formatter.FormatSuccess(cmd.Writer, "Role assigned to team")
}

func (h *TeamHandler) UnassignRole(ctx context.Context, cmd *cli.Command) error {
	if err := h.repo.UnassignRole(ctx, cmd.String("id")); err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	return h.formatter.FormatSuccess(cmd.Writer, "Role removed from team")
}
