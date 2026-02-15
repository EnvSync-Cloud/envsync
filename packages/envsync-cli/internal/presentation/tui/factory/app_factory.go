package factory

import (
	"context"
	"errors"
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/huh"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/presentation/tui/component"
	// "github.com/EnvSync-Cloud/envsync-cli/internal/presentation/tui/models/app_model"
)

type AppFactory struct{}

func NewAppFactory() *AppFactory {
	return &AppFactory{}
}

// CreateAppTUI runs the interactive app creation flow
func (f *AppFactory) CreateAppTUI(ctx context.Context, app *domain.Application) (*domain.Application, error) {
	var confirm bool

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Title("Application Name").
				Description("Enter a unique name for your application").
				Placeholder("my-awesome-app").
				Value(&app.Name).
				Validate(func(str string) error {
					if strings.TrimSpace(str) == "" {
						return fmt.Errorf("application name is required")
					}
					if len(str) > 100 {
						return fmt.Errorf("application name must be 100 characters or less")
					}
					return nil
				}),

			huh.NewText().
				Title("Description").
				Description("Provide a description for your application").
				Placeholder("A brief description of what this application does...").
				Value(&app.Description).
				Lines(3).
				Validate(func(str string) error {
					if strings.TrimSpace(str) == "" {
						return fmt.Errorf("application description is required")
					}
					if len(str) > 500 {
						return fmt.Errorf("description must be 500 characters or less")
					}
					return nil
				}),
			huh.NewConfirm().
				Title("Are you sure?").
				Affirmative("Yes!").
				Negative("No.").
				Value(&confirm),
		),
	).WithTheme(huh.ThemeCharm())

	err := form.Run()
	if err != nil {
		return nil, err
	}

	if !confirm {
		return nil, errors.New("application creation cancelled by user")
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
