package handlers

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/spinner"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/factory"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
)

type AccessHandler struct {
	repo      repository.AccessRepository
	appRepo   repository.ApplicationRepository
	userRepo  repository.UserRepository
	teamRepo  repository.TeamRepository
	formatter *formatters.BaseFormatter
	tui       *factory.AccessFactory
}

func NewAccessHandler(tui *factory.AccessFactory) *AccessHandler {
	return &AccessHandler{
		repo:      repository.NewAccessRepository(),
		appRepo:   repository.NewApplicationRepository(),
		userRepo:  repository.NewUserRepository(),
		teamRepo:  repository.NewTeamRepository(),
		formatter: formatters.NewBaseFormatter(),
		tui:       tui,
	}
}

func (h *AccessHandler) GrantApp(ctx context.Context, cmd *cli.Command) error {
	appID := cmd.String("app-id")
	subjectID := cmd.String("subject-id")
	subjectType := cmd.String("subject-type")
	relation := cmd.String("relation")

	// Flag values are held to the same list the TUI steps offer.
	if subjectType != "" {
		resolved, ok := domain.ResolveAccessSubjectType(subjectType)
		if !ok {
			return h.formatter.FormatError(cmd.ErrWriter, fmt.Sprintf("invalid subject-type %q: must be user or team", subjectType))
		}
		subjectType = resolved
	}
	if relation != "" {
		resolved, ok := domain.ResolveAccessRelation(relation)
		if !ok {
			return h.formatter.FormatError(cmd.ErrWriter, fmt.Sprintf("invalid relation %q: must be viewer, editor or admin", relation))
		}
		relation = resolved
	}

	// Flags alone can carry a run when they cover every field; the wizard
	// collects what is missing: application, then the subject (its type first,
	// then the user or team table), then the relation. JSON output is for
	// scripts: it takes flag values only and never opens the TUI.
	if appID == "" || subjectID == "" || subjectType == "" || relation == "" {
		if cmd.Bool("json") {
			return h.formatter.FormatError(cmd.ErrWriter, "app-id, subject-id, subject-type and relation must be provided with json flag")
		}
		if !spinner.IsTerminal(os.Stdin) {
			return h.formatter.FormatError(cmd.ErrWriter, "app-id, subject-id, subject-type and relation are required; provide --app-id, --subject-id, --subject-type and --relation flags")
		}

		if appID == "" {
			apps, err := h.fetchApps(ctx)
			if err != nil {
				return h.formatter.FormatError(cmd.ErrWriter, err.Error())
			}
			id, ok, err := h.tui.PickApplication(apps, "Select the application")
			if err != nil {
				return h.formatter.FormatError(cmd.ErrWriter, err.Error())
			}
			if !ok {
				return h.formatter.FormatError(cmd.ErrWriter, "access grant cancelled by user")
			}
			appID = id
		}

		if subjectType == "" {
			value, ok, err := h.tui.SelectSubjectType()
			if err != nil {
				return h.formatter.FormatError(cmd.ErrWriter, err.Error())
			}
			if !ok {
				return h.formatter.FormatError(cmd.ErrWriter, "access grant cancelled by user")
			}
			subjectType = value
		}

		if subjectID == "" {
			if subjectType == "team" {
				teams, err := h.fetchTeams(ctx)
				if err != nil {
					return h.formatter.FormatError(cmd.ErrWriter, err.Error())
				}
				id, ok, err := h.tui.PickTeam(teams, "Select the team")
				if err != nil {
					return h.formatter.FormatError(cmd.ErrWriter, err.Error())
				}
				if !ok {
					return h.formatter.FormatError(cmd.ErrWriter, "access grant cancelled by user")
				}
				subjectID = id
			} else {
				users, err := h.fetchUsers(ctx)
				if err != nil {
					return h.formatter.FormatError(cmd.ErrWriter, err.Error())
				}
				id, ok, err := h.tui.PickUser(users, "Select the user")
				if err != nil {
					return h.formatter.FormatError(cmd.ErrWriter, err.Error())
				}
				if !ok {
					return h.formatter.FormatError(cmd.ErrWriter, "access grant cancelled by user")
				}
				subjectID = id
			}
		}

		if relation == "" {
			value, ok, err := h.tui.SelectRelation()
			if err != nil {
				return h.formatter.FormatError(cmd.ErrWriter, err.Error())
			}
			if !ok {
				return h.formatter.FormatError(cmd.ErrWriter, "access grant cancelled by user")
			}
			relation = value
		}
	}

	if err := h.repo.GrantAppAccess(ctx, appID, subjectID, subjectType, relation); err != nil {
		return h.formatter.FormatError(cmd.ErrWriter, err.Error())
	}
	return h.formatter.FormatSuccess(cmd.Writer, "App access granted")
}

// fetchApps loads the applications with the shared loader presentation.
func (h *AccessHandler) fetchApps(ctx context.Context) ([]factory.AccessChoice, error) {
	sp := spinner.New("Fetching applications…", spinner.IsTerminal(os.Stderr), os.Stderr)
	sp.Start()
	defer sp.Stop()

	apps, err := h.appRepo.GetAll(ctx)
	if err != nil {
		return nil, err
	}
	if len(apps) == 0 {
		return nil, errors.New("no applications available; create one with 'envsync app create'")
	}

	choices := make([]factory.AccessChoice, 0, len(apps))
	for _, a := range apps {
		choices = append(choices, factory.AccessChoice{ID: a.ID, Cells: []string{a.Name, a.Description}})
	}
	return choices, nil
}

// fetchUsers loads the organization users with the shared loader presentation.
func (h *AccessHandler) fetchUsers(ctx context.Context) ([]factory.AccessChoice, error) {
	sp := spinner.New("Fetching users…", spinner.IsTerminal(os.Stderr), os.Stderr)
	sp.Start()
	defer sp.Stop()

	users, err := h.userRepo.GetAll(ctx)
	if err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return nil, errors.New("no users available")
	}

	choices := make([]factory.AccessChoice, 0, len(users))
	for _, u := range users {
		choices = append(choices, factory.AccessChoice{ID: u.ID, Cells: []string{u.Email}})
	}
	return choices, nil
}

// fetchTeams loads the organization teams with the shared loader presentation.
func (h *AccessHandler) fetchTeams(ctx context.Context) ([]factory.AccessChoice, error) {
	sp := spinner.New("Fetching teams…", spinner.IsTerminal(os.Stderr), os.Stderr)
	sp.Start()
	defer sp.Stop()

	teams, err := h.teamRepo.List(ctx)
	if err != nil {
		return nil, err
	}
	if len(teams) == 0 {
		return nil, errors.New("no teams available")
	}

	choices := make([]factory.AccessChoice, 0, len(teams))
	for _, t := range teams {
		description := ""
		if t.Description != nil {
			description = *t.Description
		}
		choices = append(choices, factory.AccessChoice{ID: t.ID, Cells: []string{t.Name, description}})
	}
	return choices, nil
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
