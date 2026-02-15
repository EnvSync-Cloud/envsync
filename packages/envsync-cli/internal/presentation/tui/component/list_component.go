package component

import (
	"io"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// ListDisplayItem wraps any type T to implement the list.Item interface
type ListDisplayItem[T any] struct {
	Item     T
	TitleFn  func(T) string
	DescFn   func(T) string
	FilterFn func(T) string
}

// FilterValue returns the string that should be matched when filtering
func (i ListDisplayItem[T]) FilterValue() string {
	if i.FilterFn != nil {
		return i.FilterFn(i.Item)
	}
	return i.TitleFn(i.Item)
}

// Title returns the title for the list item
func (i ListDisplayItem[T]) Title() string {
	return i.TitleFn(i.Item)
}

// Description returns the description for the list item (required by list.Item)
func (i ListDisplayItem[T]) Description() string {
	return i.DescFn(i.Item)
}

// GetValue returns the underlying item
func (i ListDisplayItem[T]) GetValue() T {
	return i.Item
}

// GenericListModel represents a generic list component using bubbles/list
type GenericListModel[T any] struct {
	list       list.Model
	items      []T
	title      string
	emptyMsg   string
	width      int
	height     int
	showHelp   bool
	showStatus bool
	showPaging bool
	filtering  bool
}

// Define custom styles for the generic list (same as original)
var (
	genericDocStyle = lipgloss.NewStyle().Margin(1, 2)
)

// GenericCustomDelegate extends the default list delegate with custom styling
type GenericCustomDelegate struct {
	list.DefaultDelegate
}

// NewGenericCustomDelegate creates a new custom delegate (same styling as original)
func NewGenericCustomDelegate() *GenericCustomDelegate {
	d := &GenericCustomDelegate{
		DefaultDelegate: list.NewDefaultDelegate(),
	}

	// Customize the delegate styles (same as original)
	d.ShowDescription = true
	d.SetHeight(4) // Increase height to accommodate multi-line descriptions
	d.SetSpacing(1)

	// Define custom styles (same as original)
	d.Styles.SelectedTitle = d.Styles.SelectedTitle.
		Border(lipgloss.NormalBorder(), false, false, false, true).
		BorderForeground(lipgloss.AdaptiveColor{Light: "#F793FF", Dark: "#AD58B4"}).
		Foreground(lipgloss.AdaptiveColor{Light: "#EE6FF8", Dark: "#EE6FF8"}).
		Bold(true)

	d.Styles.SelectedDesc = d.Styles.SelectedDesc.
		Border(lipgloss.NormalBorder(), false, false, false, true).
		BorderForeground(lipgloss.AdaptiveColor{Light: "#F793FF", Dark: "#AD58B4"}).
		Foreground(lipgloss.AdaptiveColor{Light: "#AD58B4", Dark: "#AD58B4"})

	return d
}

// Render implements the list.ItemDelegate interface
func (d GenericCustomDelegate) Render(w io.Writer, m list.Model, index int, listItem list.Item) {
	d.DefaultDelegate.Render(w, m, index, listItem)
}

// GenericListConfig holds configuration for creating a generic list
type GenericListConfig[T any] struct {
	Items      []T
	Title      string
	EmptyMsg   string
	Width      int
	Height     int
	ShowHelp   bool
	ShowStatus bool
	ShowPaging bool
	Filtering  bool
	TitleFn    func(T) string
	DescFn     func(T) string
	FilterFn   func(T) string // Optional, defaults to TitleFn
}

// NewGenericListModel creates a new generic list model with the provided items and configuration
func NewGenericListModel[T any](config GenericListConfig[T]) *GenericListModel[T] {
	// Convert generic items to list.Item slice
	items := make([]list.Item, len(config.Items))
	for i, item := range config.Items {
		filterFn := config.FilterFn
		if filterFn == nil {
			filterFn = config.TitleFn
		}

		items[i] = ListDisplayItem[T]{
			Item:     item,
			TitleFn:  config.TitleFn,
			DescFn:   config.DescFn,
			FilterFn: filterFn,
		}
	}

	// Set defaults
	width := config.Width
	if width == 0 {
		width = 80
	}
	height := config.Height
	if height == 0 {
		height = 24
	}

	title := config.Title
	if title == "" {
		title = "📋 Items List"
	}

	emptyMsg := config.EmptyMsg
	if emptyMsg == "" {
		emptyMsg = `📭 No items found.

💡 Add some items to get started!

Press Q to quit.`
	}

	// Create the list with custom delegate
	delegate := NewGenericCustomDelegate()
	l := list.New(items, delegate, width, height)

	// Configure the list
	l.Title = title
	l.SetShowStatusBar(config.ShowStatus)
	l.SetShowPagination(config.ShowPaging)
	l.SetFilteringEnabled(config.Filtering)
	l.SetShowHelp(config.ShowHelp)

	// Ensure proper sizing
	l.SetSize(width, height)

	model := &GenericListModel[T]{
		list:       l,
		items:      config.Items,
		title:      title,
		emptyMsg:   emptyMsg,
		width:      width,
		height:     height,
		showHelp:   config.ShowHelp,
		showStatus: config.ShowStatus,
		showPaging: config.ShowPaging,
		filtering:  config.Filtering,
	}

	return model
}

// Init initializes the model
func (m *GenericListModel[T]) Init() tea.Cmd {
	// Ensure the list is properly sized on initialization
	m.list.SetSize(m.width, m.height)
	return nil
}

// Update handles messages and updates the model state
func (m *GenericListModel[T]) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		h, v := genericDocStyle.GetFrameSize()
		m.width = msg.Width - h
		m.height = msg.Height - v
		m.list.SetSize(m.width, m.height)

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		}
	}

	// Update the list and get any commands
	var cmd tea.Cmd
	m.list, cmd = m.list.Update(msg)
	return m, cmd
}

// View renders the current view
func (m *GenericListModel[T]) View() string {
	if len(m.items) == 0 {
		return genericDocStyle.Render(m.emptyMsg)
	}

	// Ensure the list has proper dimensions
	if m.list.Width() == 0 || m.list.Height() == 0 {
		m.list.SetSize(m.width, m.height)
	}

	return genericDocStyle.Render(m.list.View())
}

// GetItems returns all items
func (m *GenericListModel[T]) GetItems() []T {
	return m.items
}

// GetSelectedItem returns the currently selected item
func (m *GenericListModel[T]) GetSelectedItem() *T {
	if item, ok := m.list.SelectedItem().(ListDisplayItem[T]); ok {
		value := item.GetValue()
		return &value
	}
	return nil
}

// GetSelectedIndex returns the index of the currently selected item
func (m *GenericListModel[T]) GetSelectedIndex() int {
	return m.list.Index()
}

// SetItems updates the items in the list
func (m *GenericListModel[T]) SetItems(items []T, titleFn func(T) string, descFn func(T) string, filterFn func(T) string) {
	m.items = items

	// Convert to list items
	listItems := make([]list.Item, len(items))
	for i, item := range items {
		if filterFn == nil {
			filterFn = titleFn
		}

		listItems[i] = ListDisplayItem[T]{
			Item:     item,
			TitleFn:  titleFn,
			DescFn:   descFn,
			FilterFn: filterFn,
		}
	}

	m.list.SetItems(listItems)
}

// SetSize updates the size of the list
func (m *GenericListModel[T]) SetSize(width, height int) {
	m.width = width
	m.height = height
	m.list.SetSize(width, height)
}

// SetTitle updates the title of the list
func (m *GenericListModel[T]) SetTitle(title string) {
	m.title = title
	m.list.Title = title
}

// IsEmpty returns true if the list has no items
func (m *GenericListModel[T]) IsEmpty() bool {
	return len(m.items) == 0
}

// Len returns the number of items in the list
func (m *GenericListModel[T]) Len() int {
	return len(m.items)
}

// Helper function to create a default configuration
func DefaultGenericListConfig[
	T any](
	items []T,
	title string,
	titleFn func(T) string,
	descFn func(T) string,
) GenericListConfig[T] {
	return GenericListConfig[T]{
		Items:      items,
		Title:      title,
		Width:      80,
		Height:     24,
		ShowHelp:   true,
		ShowStatus: true,
		ShowPaging: true,
		Filtering:  true,
		TitleFn:    titleFn,
		DescFn:     descFn,
	}
}

/*
Example Usage:

// Example with domain.Application
func CreateApplicationList(apps []domain.Application) *GenericListModel[domain.Application] {
    config := DefaultGenericListConfig(
        apps,
        "🚀 Applications List",
        func(app domain.Application) string {
            return fmt.Sprintf("📛 %s", app.Name)
        },
        func(app domain.Application) string {
            var desc strings.Builder
            desc.WriteString(fmt.Sprintf("🆔 %s\n", app.ID))
            if app.Description != "" {
                maxLen := 60
                appDesc := app.Description
                if len(appDesc) > maxLen {
                    appDesc = appDesc[:maxLen-3] + "..."
                }
                desc.WriteString(fmt.Sprintf("📝 %s\n", appDesc))
            }
            return desc.String()
        },
    )
    return NewGenericListModel(config)
}

// Example with strings
func CreateStringList(items []string) *GenericListModel[string] {
    config := DefaultGenericListConfig(
        items,
        "📝 String List",
        func(s string) string { return s },
        func(s string) string { return fmt.Sprintf("Length: %d", len(s)) },
    )
    return NewGenericListModel(config)
}

// Usage in a Bubble Tea program:
// model := CreateApplicationList(apps)
// program := tea.NewProgram(model)
// program.Run()
*/
