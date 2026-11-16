package factory

import (
	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/huh"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/component"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/styles"
)

type AccessFactory struct{}

func NewAccessFactory() *AccessFactory {
	return &AccessFactory{}
}

// AccessChoice is one selectable row of an access picker: the row's identity
// plus the summary cells shown for it.
type AccessChoice struct {
	ID    string
	Cells []string
}

// PickApplication shows the applications in a table and returns the ID of the
// one the user submits. ok is false when they quit without choosing.
func (f *AccessFactory) PickApplication(choices []AccessChoice, title string) (string, bool, error) {
	return pickAccessChoice(title, []table.Column{
		{Title: "NAME", Width: 24},
		{Title: "DESCRIPTION", Width: 32},
	}, choices)
}

// PickUser shows the users in a table and returns the ID of the one the user
// submits. ok is false when they quit without choosing.
func (f *AccessFactory) PickUser(choices []AccessChoice, title string) (string, bool, error) {
	return pickAccessChoice(title, []table.Column{
		{Title: "EMAIL", Width: 36},
	}, choices)
}

// PickTeam shows the teams in a table and returns the ID of the one the user
// submits. ok is false when they quit without choosing.
func (f *AccessFactory) PickTeam(choices []AccessChoice, title string) (string, bool, error) {
	return pickAccessChoice(title, []table.Column{
		{Title: "NAME", Width: 24},
		{Title: "DESCRIPTION", Width: 32},
	}, choices)
}

// pickAccessChoice renders the summary columns plus a zero-width ID column:
// invisible in the table (the renderer skips zero-width columns) but still the
// row's identity on submit, so a lookalike row can never resolve to the wrong
// subject.
func pickAccessChoice(title string, cols []table.Column, choices []AccessChoice) (string, bool, error) {
	rows := make([]table.Row, 0, len(choices))
	for _, c := range choices {
		// Cells and columns are written together; pad defensively so a
		// mismatch renders blanks instead of crashing the table.
		row := make(table.Row, 0, len(cols)+1)
		for i := range cols {
			if i < len(c.Cells) {
				row = append(row, c.Cells[i])
			} else {
				row = append(row, "")
			}
		}
		rows = append(rows, append(row, c.ID))
	}

	width := 0
	for _, c := range cols {
		width += c.Width + 2 // cell padding(0, 1)
	}

	row, ok, err := selectRow(component.TableConfig{
		Title:   title,
		Columns: append(cols, table.Column{Title: "ID", Width: 0}),
		Rows:    rows,
		Width:   width,
		Height:  24,
		Help:    "↑/k up • ↓/j down • enter select • q cancel",
	})
	if !ok || err != nil {
		return "", ok, err
	}

	return row[len(row)-1], true, nil
}

// SelectSubjectType asks whether the grant targets a user or a team. ok is
// false when the user backs out.
func (f *AccessFactory) SelectSubjectType() (string, bool, error) {
	return selectAccessValue(
		"Select the subject type",
		"Whether the grant targets a user or a team.",
		domain.AccessSubjectTypes(),
	)
}

// SelectRelation asks for the access level to grant. ok is false when the
// user backs out.
func (f *AccessFactory) SelectRelation() (string, bool, error) {
	return selectAccessValue(
		"Select the relation",
		"The access level to grant.",
		domain.AccessRelations(),
	)
}

// selectAccessValue asks for one value from the accepted list, offering no
// other choice. ok is false when the user backs out.
func selectAccessValue(title, description string, options []string) (string, bool, error) {
	value := options[0]
	opts := make([]huh.Option[string], 0, len(options))
	for _, o := range options {
		opts = append(opts, huh.NewOption(o, o))
	}

	form := huh.NewForm(huh.NewGroup(
		huh.NewSelect[string]().
			Title(title).
			Description(description).
			Options(opts...).
			Value(&value),
	)).WithTheme(styles.FormTheme()).WithShowHelp(false)

	if _, err := tea.NewProgram(formModel{
		form:  form,
		title: title,
		width: 80,
	}).Run(); err != nil {
		return "", false, err
	}

	if form.State == huh.StateAborted {
		return "", false, nil
	}

	return value, true, nil
}
