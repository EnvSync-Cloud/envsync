package factory

import (
	"errors"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/presentation/tui/component"
	tea "github.com/charmbracelet/bubbletea"
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
