package factory

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/huh"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/component"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/styles"
)

type ServiceTokenFactory struct{}

func NewServiceTokenFactory() *ServiceTokenFactory {
	return &ServiceTokenFactory{}
}

// ServiceTokenCreateValues are the details the creation form collects.
type ServiceTokenCreateValues struct {
	Name          string
	Read          bool
	Write         bool
	ExpiresInDays int
}

// PickApplication shows the applications in a table and returns the one the
// user submits. ok is false when they quit without choosing.
func (f *ServiceTokenFactory) PickApplication(apps []domain.Application, title string) (domain.Application, bool, error) {
	rows := make([]table.Row, 0, len(apps))
	for _, a := range apps {
		rows = append(rows, table.Row{a.Name, a.Description, a.ID})
	}

	// Full screen: the wizard runs pickers and the form back to back, and
	// stacked inline programs drift below each other's help text.
	row, ok, err := selectRow(component.TableConfig{
		Title: title,
		Columns: []table.Column{
			{Title: "NAME", Width: 24},
			{Title: "DESCRIPTION", Width: 32},
			{Title: "ID", Width: 36},
		},
		Rows:   rows,
		Width:  130,
		Height: 24,
		Help:   "↑/k up • ↓/j down • enter select • q cancel",
	}, tea.WithAltScreen())
	if !ok || err != nil {
		return domain.Application{}, ok, err
	}

	// Match on the ID cell rather than the cursor position so a reordered or
	// filtered table can never select the wrong application.
	for _, a := range apps {
		if a.ID == row[2] {
			return a, true, nil
		}
	}

	return domain.Application{}, false, fmt.Errorf("selected application %q is no longer available", row[2])
}

// PickEnvironment shows the application's environments in a table and returns
// the one the user submits. ok is false when they quit without choosing.
func (f *ServiceTokenFactory) PickEnvironment(envs []domain.EnvType, title string) (domain.EnvType, bool, error) {
	rows := make([]table.Row, 0, len(envs))
	for _, e := range envs {
		rows = append(rows, table.Row{e.Name, e.ID})
	}

	row, ok, err := selectRow(component.TableConfig{
		Title: title,
		Columns: []table.Column{
			{Title: "NAME", Width: 28},
			{Title: "ID", Width: 36},
		},
		Rows:   rows,
		Width:  100,
		Height: 24,
		Help:   "↑/k up • ↓/j down • enter select • q cancel",
	}, tea.WithAltScreen())
	if !ok || err != nil {
		return domain.EnvType{}, ok, err
	}

	for _, e := range envs {
		if e.ID == row[1] {
			return e, true, nil
		}
	}

	return domain.EnvType{}, false, fmt.Errorf("selected environment %q is no longer available", row[1])
}

// CreateTokenTUI runs the interactive form for the remaining details.
//
// The fields mirror the `service-token create` flags; values already set (from
// flags) are offered as starting points and can be edited in the form.
func (f *ServiceTokenFactory) CreateTokenTUI(preset ServiceTokenCreateValues) (ServiceTokenCreateValues, error) {
	name := preset.Name
	read := preset.Read
	write := preset.Write
	expiresText := "0"
	if preset.ExpiresInDays > 0 {
		expiresText = strconv.Itoa(preset.ExpiresInDays)
	}

	details := huh.NewGroup(
		huh.NewInput().
			Title("Name").
			Description("Service token name.").
			Placeholder("ci-deployer").
			Value(&name).
			Validate(func(s string) error {
				if strings.TrimSpace(s) == "" {
					return fmt.Errorf("name is required")
				}
				if len(s) > 100 {
					return fmt.Errorf("name must be 100 characters or less")
				}
				return nil
			}),

		huh.NewConfirm().
			Title("Read access?").
			Description("Allow the token to read secrets.").
			Affirmative("Yes").
			Negative("No").
			Value(&read),

		huh.NewConfirm().
			Title("Write access?").
			Description("Allow the token to change secrets.").
			Affirmative("Yes").
			Negative("No").
			Value(&write),

		huh.NewInput().
			Title("Expires in days").
			Description("Leave 0 to use the server default.").
			Placeholder("0").
			Value(&expiresText).
			Validate(func(s string) error {
				s = strings.TrimSpace(s)
				if s == "" {
					return nil
				}
				days, err := strconv.Atoi(s)
				if err != nil || days < 0 {
					return fmt.Errorf("must be zero or a positive number of days")
				}
				return nil
			}),
	).Title("Service token")

	form := huh.NewForm(details).
		WithTheme(styles.FormTheme()).
		WithShowHelp(false)

	// Full screen like the pickers that precede it: an inline form would stack
	// below their frames and drift past the help text on short terminals.
	if _, err := tea.NewProgram(formModel{
		form:  form,
		title: "Create service token",
		width: 80,
	}, tea.WithAltScreen()).Run(); err != nil {
		return ServiceTokenCreateValues{}, err
	}

	if form.State == huh.StateAborted {
		return ServiceTokenCreateValues{}, errors.New("service token creation cancelled by user")
	}

	expiresInDays := 0
	if s := strings.TrimSpace(expiresText); s != "" {
		expiresInDays, _ = strconv.Atoi(s)
	}

	return ServiceTokenCreateValues{
		Name:          name,
		Read:          read,
		Write:         write,
		ExpiresInDays: expiresInDays,
	}, nil
}
