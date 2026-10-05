package factory

import (
	"errors"
	"fmt"

	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/component"
)

type EnvFactory struct{}

func NewEnvFactory() *EnvFactory {
	return &EnvFactory{}
}

func (f *EnvFactory) SelectEnvironmentTUI(envs []domain.EnvType) (domain.EnvType, error) {
	adapter := func(item domain.EnvType, selected bool, multiSelect bool) component.GenericListItem[domain.EnvType] {
		return component.GenericListItem[domain.EnvType]{
			Item:        item,
			TitleStr:    item.Name,
			DescStr:     item.ID,
			FilterStr:   item.Name,
			Selected:    selected,
			MultiSelect: multiSelect,
		}
	}
	keyFn := func(e domain.EnvType) string { return e.ID }

	model := component.NewSelectableListModel(
		envs,
		adapter,
		"Select Environment",
		80, 20,
		false,
		keyFn,
	)

	p := tea.NewProgram(model, tea.WithAltScreen())
	finalModel, err := p.Run()
	if err != nil {
		return domain.EnvType{}, err
	}
	selected := finalModel.(*component.SelectableListModel[domain.EnvType]).GetSelectedItems()
	if len(selected) == 0 {
		return domain.EnvType{}, errors.New("no environment type selected")
	}
	return selected[0], nil
}

// envTableColumns are the columns shared by every environment table.
func envTableColumns() []table.Column {
	return []table.Column{
		{Title: "NAME", Width: 24},
		{Title: "ID", Width: 36},
		{Title: "DEFAULT", Width: 8},
		{Title: "PROTECTED", Width: 10},
	}
}

// envTableRows projects environments onto those columns.
func envTableRows(envs []domain.EnvType) []table.Row {
	rows := make([]table.Row, 0, len(envs))
	for _, e := range envs {
		rows = append(rows, table.Row{e.Name, e.ID, boolWord(e.IsDefault), boolWord(e.IsProtected)})
	}
	return rows
}

func boolWord(v bool) string {
	if v {
		return "yes"
	}
	return "no"
}

// ListEnvsInteractive runs the interactive environment listing flow
func (f *EnvFactory) ListEnvsInteractive(envs []domain.EnvType) error {
	model := component.NewTableModel(component.TableConfig{
		Title:   "Environments",
		Columns: envTableColumns(),
		Rows:    envTableRows(envs),
		Width:   108,
		Height:  24,
	})

	if _, err := tea.NewProgram(model).Run(); err != nil {
		return fmt.Errorf("error running env list TUI: %w", err)
	}

	return nil
}
