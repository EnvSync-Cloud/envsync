package component

import (
	"strings"

	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/styles"
)

// TableConfig describes a tabular view.
type TableConfig struct {
	Title   string
	Columns []table.Column
	Rows    []table.Row
	Width   int
	Height  int
}

// TableModel renders tabular data with bubbles/table.
type TableModel struct {
	table    table.Model
	title    string
	width    int
	rowCount int
}

// bodyHeight sizes the table to the data: tall enough for the rows, never
// padded out to fill the screen, and never taller than the terminal allows.
func (m *TableModel) bodyHeight(termHeight int) int {
	h := m.rowCount + 1                 // rows + header
	if max := termHeight - 4; h > max { // header + blank above, blank + footer below
		h = max
	}
	if h < 3 {
		h = 3
	}
	return h
}

// NewTableModel builds a table styled with the shared brand palette.
func NewTableModel(cfg TableConfig) *TableModel {
	if cfg.Width == 0 {
		cfg.Width = 80
	}
	if cfg.Height == 0 {
		cfg.Height = 24
	}

	m := &TableModel{
		title:    cfg.Title,
		width:    cfg.Width,
		rowCount: len(cfg.Rows),
	}

	// A rendered row is the columns plus Cell's horizontal padding, so derive
	// the table width from the columns. Setting it wider leaves a gap between
	// the data and the header rule / surrounding box.
	rowWidth := 0
	for _, c := range cfg.Columns {
		rowWidth += c.Width + 2 // cell padding(0, 1)
	}

	m.table = table.New(
		table.WithColumns(cfg.Columns),
		table.WithRows(cfg.Rows),
		table.WithWidth(rowWidth),
		table.WithHeight(m.bodyHeight(cfg.Height)),
		table.WithFocused(true),
	)

	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(styles.DarkGrayColor).
		BorderBottom(true).
		Foreground(styles.PrimaryColor).
		Bold(true).
		Padding(0, 1)
	s.Cell = s.Cell.Padding(0, 1)
	s.Selected = s.Selected.
		Foreground(styles.LightGrayColor).
		Background(styles.SecondaryColor).
		Bold(false)
	m.table.SetStyles(s)

	return m
}

func (m *TableModel) Init() tea.Cmd { return nil }

func (m *TableModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.table.SetHeight(m.bodyHeight(msg.Height))
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q", "esc":
			return m, tea.Quit
		}
	}

	var cmd tea.Cmd
	m.table, cmd = m.table.Update(msg)
	return m, cmd
}

// tableBox frames the table, matching the bubbletea table example.
var tableBox = lipgloss.NewStyle().
	BorderStyle(lipgloss.NormalBorder()).
	BorderForeground(styles.DarkGrayColor)

func (m *TableModel) View() string {
	var b strings.Builder
	b.WriteString(styles.Boundary(m.width, m.title, styles.FormHeaderStyle, styles.FormBoundaryFillStyle))
	b.WriteString("\n\n")
	b.WriteString(tableBox.Render(m.table.View()))
	b.WriteString("\n")
	b.WriteString(styles.Boundary(m.width, "↑/k up • ↓/j down • q quit", styles.FormFooterStyle, styles.FormBoundaryFillStyle))
	return b.String()
}

// SelectedRow returns the row under the cursor, or nil when there is none.
func (m *TableModel) SelectedRow() table.Row {
	return m.table.SelectedRow()
}
