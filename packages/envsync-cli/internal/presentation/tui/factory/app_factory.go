package factory

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/huh"
	"github.com/charmbracelet/lipgloss"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/component"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/styles"
)

type AppFactory struct{}

// formModel wraps a huh form with the slash boundary header and footer that
// frame the interactive flows.
type formModel struct {
	form  *huh.Form
	title string
	width int
}

func (m formModel) Init() tea.Cmd {
	return m.form.Init()
}

func (m formModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	if size, ok := msg.(tea.WindowSizeMsg); ok {
		m.width = size.Width
		// The form is wrapped in a header and a help footer it does not know
		// about. Hand it the height that is left, or tall fields (like the file
		// picker) grow past the help text and off the screen.
		avail := size.Height - m.chromeHeight()
		if avail < 1 {
			avail = 1
		}
		msg = tea.WindowSizeMsg{Width: size.Width, Height: avail}
	}

	form, cmd := m.form.Update(msg)
	if f, ok := form.(*huh.Form); ok {
		m.form = f
	}

	if m.form.State == huh.StateCompleted || m.form.State == huh.StateAborted {
		return m, tea.Quit
	}

	return m, cmd
}

// chromeHeight reports how many lines the header and footer add around the
// form view.
func (m formModel) chromeHeight() int {
	return lipgloss.Height(m.header()) + 1 + lipgloss.Height(m.footer())
}

// header renders the slash boundary line above the form.
func (m formModel) header() string {
	return styles.Boundary(m.formWidth(), m.title, styles.FormHeaderStyle, styles.FormBoundaryFillStyle)
}

// footer renders the slash boundary line with the form's key help below it.
func (m formModel) footer() string {
	return styles.Boundary(m.formWidth(), m.form.Help().ShortHelpView(m.form.KeyBinds()), styles.FormFooterStyle, styles.FormBoundaryFillStyle)
}

func (m formModel) formWidth() int {
	if m.width <= 0 {
		return 80
	}
	return m.width
}

func (m formModel) View() string {
	// The chrome belongs to the form only. Once the form is submitted or
	// aborted it is dropped, so the header is not left on screen above the
	// loader and the success message.
	if m.form.State != huh.StateNormal {
		return m.form.View()
	}

	return m.header() + "\n\n" + m.form.View() + "\n" + m.footer()
}

func NewAppFactory() *AppFactory {
	return &AppFactory{}
}

// CreateAppTUI runs the interactive app creation flow.
//
// The fields mirror the `app create` flags. The public key is only offered when
// secret encryption is enabled, and it is optional there.
func (f *AppFactory) CreateAppTUI(ctx context.Context, app *domain.Application) (*domain.Application, error) {
	var (
		metadataText  string
		defaultTypes  bool
		enableSecrets bool
		publicKey     string
	)

	details := huh.NewGroup(
		huh.NewInput().
			Title("Application Name").
			Description("Used across the CLI and the dashboard.").
			Placeholder("my-awesome-app").
			Value(&app.Name).
			Validate(func(s string) error {
				name := strings.TrimSpace(s)
				if name == "" {
					return fmt.Errorf("application name is required")
				}
				if len(name) > 100 {
					return fmt.Errorf("application name must be 100 characters or less")
				}
				return nil
			}),

		huh.NewText().
			Title("Description").
			Description("A brief description of what this application does.").
			Placeholder("Customer-facing REST API.").
			Value(&app.Description).
			Lines(3).
			Validate(func(s string) error {
				if strings.TrimSpace(s) == "" {
					return fmt.Errorf("application description is required")
				}
				if len(s) > 500 {
					return fmt.Errorf("description must be 500 characters or less")
				}
				return nil
			}),

		huh.NewText().
			Title("Metadata (optional)").
			Description("One key=value pair per line.").
			Placeholder("team=core\nowner=platform").
			Value(&metadataText).
			Lines(3),
	).Title("Application details")

	options := huh.NewGroup(
		huh.NewConfirm().
			Title("Enable secret encryption?").
			Description("Encrypts the secrets stored for this application.").
			Affirmative("Yes").
			Negative("No").
			WithButtonAlignment(lipgloss.Left).
			Value(&enableSecrets),

		huh.NewConfirm().
			Title("Create default environment types?").
			Description("Creates the default environment types: Production, Development, and Staging.").
			Affirmative("Yes").
			Negative("No").
			WithButtonAlignment(lipgloss.Left).
			Value(&defaultTypes),
	).Title("Options")

	// huh can only hide whole groups, so the public key gets its own step and
	// is skipped entirely when secret encryption is off.
	encryption := huh.NewGroup(
		huh.NewText().
			Title("Public Key (optional)").
			Description("PEM public key used to encrypt secrets. Leave blank and EnvSync will generate and manage one for you.").
			Placeholder("-----BEGIN PUBLIC KEY-----").
			Value(&publicKey).
			Lines(4),
	).Title("Encryption").
		WithHideFunc(func() bool { return !enableSecrets })

	form := huh.NewForm(details, options, encryption).
		WithTheme(styles.FormTheme()).
		WithShowHelp(false)

	if _, err := tea.NewProgram(formModel{
		form:  form,
		title: "Create application",
		width: 80,
	}).Run(); err != nil {
		return nil, err
	}

	if form.State == huh.StateAborted {
		return nil, errors.New("application creation cancelled by user")
	}

	// The textarea is free-form, so blank lines are simply ignored.
	var entries []string
	for _, line := range strings.Split(metadataText, "\n") {
		if strings.TrimSpace(line) != "" {
			entries = append(entries, line)
		}
	}
	metadata, err := domain.ParseMetadata(entries)
	if err != nil {
		return nil, fmt.Errorf("invalid metadata: %w", err)
	}

	app.Metadata = metadata
	app.EnableSecrets = enableSecrets
	app.PublicKey = strings.TrimSpace(publicKey)
	app.IsManagedSecret = enableSecrets && app.PublicKey == ""
	if defaultTypes {
		app.EnvTypes = append(app.EnvTypes, domain.DefaultEnvTypes...)
	}

	return app, nil
}

// appTableColumns are the columns shared by every application table.
func appTableColumns() []table.Column {
	return []table.Column{
		{Title: "NAME", Width: 24},
		{Title: "ID", Width: 22},
		{Title: "DESCRIPTION", Width: 48},
		{Title: "ENVS", Width: 6},
	}
}

// appTableRows projects applications onto those columns.
func appTableRows(apps []domain.Application) []table.Row {
	rows := make([]table.Row, 0, len(apps))
	for _, a := range apps {
		envCount := strconv.Itoa(len(a.EnvTypes))
		if a.EnvCount != "" {
			envCount = a.EnvCount
		}
		rows = append(rows, table.Row{a.Name, a.ID, a.Description, envCount})
	}
	return rows
}

// ListAppsInteractive runs the interactive app listing flow
func (f *AppFactory) ListAppsInteractive(apps []domain.Application) error {
	model := component.NewTableModel(component.TableConfig{
		Title:   "Applications",
		Columns: appTableColumns(),
		Rows:    appTableRows(apps),
		Width:   108,
		Height:  24,
	})

	// No alt screen: the table renders inline rather than taking over the
	// terminal.
	if _, err := tea.NewProgram(model).Run(); err != nil {
		return fmt.Errorf("error running app list TUI: %w", err)
	}

	return nil
}

// selectRow runs a selectable table and returns the row the user submits. ok is
// false when they quit without choosing. Program options let a multi-step flow
// run the table full screen so it cannot stack with the next step.
func selectRow(cfg component.TableConfig, opts ...tea.ProgramOption) (table.Row, bool, error) {
	cfg.Selectable = true
	model := component.NewTableModel(cfg)

	final, err := tea.NewProgram(model, opts...).Run()
	if err != nil {
		return nil, false, fmt.Errorf("error running selection table: %w", err)
	}

	picked, ok := final.(*component.TableModel)
	if !ok || !picked.Submitted() {
		return nil, false, nil
	}

	row := picked.SelectedRow()
	if row == nil {
		return nil, false, nil
	}
	return row, true, nil
}

// PickApp shows the applications in a table and returns the one the user
// submits. ok is false when they quit without choosing.
func (f *AppFactory) PickApp(apps []domain.Application) (domain.Application, bool, error) {
	row, ok, err := selectRow(component.TableConfig{
		Title:   "Select the application to delete",
		Columns: appTableColumns(),
		Rows:    appTableRows(apps),
		Width:   108,
		Height:  24,
		Confirm: func(row table.Row) string {
			return fmt.Sprintf("Delete '%s'?", row[0])
		},
		Help: "↑/k up • ↓/j down • enter select • q cancel",
	})
	if !ok || err != nil {
		return domain.Application{}, ok, err
	}

	// Match on the ID cell rather than the cursor position so a reordered or
	// filtered table can never select the wrong application.
	for _, a := range apps {
		if a.ID == row[1] {
			return a, true, nil
		}
	}

	return domain.Application{}, false, fmt.Errorf("selected application %q is no longer available", row[1])
}
