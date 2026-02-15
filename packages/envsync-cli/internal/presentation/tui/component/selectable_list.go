package component

import (
	"slices"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
)

// GenericListItem adapts any type T to the list.Item interface.
type GenericListItem[T any] struct {
	Item        T
	TitleStr    string
	DescStr     string
	FilterStr   string
	Selected    bool
	MultiSelect bool
}

func (i GenericListItem[T]) Title() string {
	if i.MultiSelect {
		checkbox := "[ ]"
		if i.Selected {
			checkbox = "[x]"
		}
		return checkbox + " " + i.TitleStr
	}
	// Single select mode: just show the title
	return i.TitleStr
}
func (i GenericListItem[T]) Description() string { return i.DescStr }
func (i GenericListItem[T]) FilterValue() string { return i.FilterStr }
func (i GenericListItem[T]) Value() T            { return i.Item }

// SelectableListModel is a generic Bubble Tea model for selecting items from a list, with multi-select support.
type SelectableListModel[T any] struct {
	list        list.Model
	items       []T
	selected    []T
	multiSelect bool
	adapterFn   func(T, bool, bool) GenericListItem[T]
	keyFn       func(T) string
}

func NewSelectableListModel[T any](
	items []T,
	adapterFn func(T, bool, bool) GenericListItem[T],
	title string,
	width, height int,
	multiSelect bool,
	keyFn func(T) string,
) *SelectableListModel[T] {
	listItems := make([]list.Item, len(items))
	selected := make([]T, 0)
	for i, it := range items {
		listItems[i] = adapterFn(it, false, multiSelect)
	}
	l := list.New(listItems, list.NewDefaultDelegate(), width, height)
	l.Title = title
	l.SetShowStatusBar(true)
	l.SetShowPagination(true)
	l.SetFilteringEnabled(true)
	l.SetShowHelp(true)
	return &SelectableListModel[T]{
		list:        l,
		items:       items,
		selected:    selected,
		multiSelect: multiSelect,
		adapterFn:   adapterFn,
		keyFn:       keyFn,
	}
}

func (m *SelectableListModel[T]) Init() tea.Cmd {
	return nil
}

func (m *SelectableListModel[T]) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.list.SetSize(msg.Width, msg.Height)
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case " ":
			if m.multiSelect {
				m.toggleSelected()
			}
		case "enter":
			if !m.multiSelect {
				// Single select: select current item and quit
				index := m.list.Index()
				if index >= 0 && index < len(m.items) {
					m.selected = []T{m.items[index]}
				}
				return m, tea.Quit
			}
			return m, tea.Quit
		case "a":
			if m.multiSelect {
				m.selectAll()
			}
		case "n":
			if m.multiSelect {
				m.clearSelection()
			}
		}
	}
	m.refreshListItems()
	m.list, cmd = m.list.Update(msg)
	return m, cmd
}

func (m *SelectableListModel[T]) View() string {
	if len(m.items) == 0 {
		return "\n📭 No items found.\n\nPress Q to quit.\n"
	}
	return m.list.View()
}

func (m *SelectableListModel[T]) GetSelectedItems() []T {
	if m.multiSelect {
		return m.selected
	}
	// Single select: return the currently selected item
	if item, ok := m.list.SelectedItem().(GenericListItem[T]); ok {
		return []T{item.Value()}
	}
	return nil
}

func (m *SelectableListModel[T]) isSelected(item T) bool {
	return slices.ContainsFunc(m.selected, func(sel T) bool {
		return m.keyFn(sel) == m.keyFn(item)
	})
}

func (m *SelectableListModel[T]) toggleSelected() {
	index := m.list.Index()
	if index < 0 || index >= len(m.items) {
		return
	}
	item := m.items[index]
	if m.isSelected(item) {
		// Deselect
		idx := slices.IndexFunc(m.selected, func(sel T) bool { return m.keyFn(sel) == m.keyFn(item) })
		if idx >= 0 {
			m.selected = append(m.selected[:idx], m.selected[idx+1:]...)
		}
	} else {
		// Select
		m.selected = append(m.selected, item)
	}
}

func (m *SelectableListModel[T]) selectAll() {
	m.selected = slices.Clone(m.items)
}

func (m *SelectableListModel[T]) clearSelection() {
	m.selected = []T{}
}

// refreshListItems updates the list items with the current selection state.
func (m *SelectableListModel[T]) refreshListItems() {
	for i, it := range m.items {
		selected := m.isSelected(it)
		m.list.SetItem(i, m.adapterFn(it, selected, m.multiSelect)) // Pass multiSelect
	}
}
