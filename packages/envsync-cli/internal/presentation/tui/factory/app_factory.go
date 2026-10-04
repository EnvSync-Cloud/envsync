package factory

import (
	"context"
	"errors"
	"fmt"
	"strings"

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

func (m formModel) View() string {
	// The chrome belongs to the form only. Once the form is submitted or
	// aborted it is dropped, so the header is not left on screen above the
	// loader and the success message.
	if m.form.State != huh.StateNormal {
		return m.form.View()
	}

	width := m.width
	if width <= 0 {
		width = 80
	}

	header := styles.Boundary(width, m.title, styles.FormHeaderStyle, styles.FormBoundaryFillStyle)
	footer := styles.Boundary(width, m.form.Help().ShortHelpView(m.form.KeyBinds()), styles.FormFooterStyle, styles.FormBoundaryFillStyle)

	return header + "\n\n" + m.form.View() + "\n" + footer
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

// DeleteAppTUI runs the interactive app deletion flow using Bubble Tea
func (f *AppFactory) DeleteAppsTUI(apps []domain.Application) ([]domain.Application, error) {
	adapter := func(item domain.Application, selected bool, multiSelect bool) component.GenericListItem[domain.Application] {
		return component.GenericListItem[domain.Application]{
			Item:        item,
			TitleStr:    item.Name,
			DescStr:     item.ID,
			FilterStr:   item.Name,
			Selected:    selected,
			MultiSelect: multiSelect,
		}
	}
	keyFn := func(e domain.Application) string { return e.ID }

	model := component.NewSelectableListModel(
		apps,
		adapter,
		"🗑️ Select Environment",
		80, 20,
		true,
		keyFn,
	)

	program := tea.NewProgram(model, tea.WithAltScreen())

	finalModel, err := program.Run()
	if err != nil {
		return nil, err
	}

	deleteModel := finalModel.(*component.SelectableListModel[domain.Application]).GetSelectedItems()

	return deleteModel, nil
}

// ListAppsInteractive runs the interactive app listing flow
func (f *AppFactory) ListAppsInteractive(apps []domain.Application) error {
	// // Create the list model with loading capability
	config := component.DefaultGenericListConfig(
		apps,
		"🚀 Applications List",
		func(app domain.Application) string {
			return fmt.Sprintf("📛 %s", app.Name)
		},
		func(app domain.Application) string {
			return fmt.Sprintf("🆔 %s\n📝 %s", app.ID, app.Description)
		},
	)

	model := component.NewGenericListModel(config)

	// Run the program
	program := tea.NewProgram(
		model,
		tea.WithAltScreen(),
	)

	_, err := program.Run()
	if err != nil {
		return fmt.Errorf("error running app list TUI: %w", err)
	}

	return nil
}
