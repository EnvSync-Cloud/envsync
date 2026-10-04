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
	// Selectable makes Enter submit the highlighted row and quit.
	Selectable bool
	// Confirm, when set with Selectable, turns that submit into an overlay
	// asking the question it returns for the highlighted row.
	Confirm func(table.Row) string
	// Help replaces the default footer hint.
	Help string
}

// TableModel renders tabular data with bubbles/table.
type TableModel struct {
	table      table.Model
	title      string
	help       string
	confirm    func(table.Row) string
	width      int
	rowCount   int
	selectable bool
	submitted  bool
	confirming bool
}

// minBodyRows is the floor for the visible data area, so a short list still
// reads as a table rather than a couple of lines.
const minBodyRows = 5

// bodyHeight sizes the table to the data: at least five rows, tall enough to
// show every row, and never taller than the terminal allows.
func (m *TableModel) bodyHeight(termHeight int) int {
	rows := m.rowCount
	if rows < minBodyRows {
		rows = minBodyRows
	}
	h := rows + 1 // data rows + header

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
		title:      cfg.Title,
		help:       cfg.Help,
		confirm:    cfg.Confirm,
		width:      cfg.Width,
		rowCount:   len(cfg.Rows),
		selectable: cfg.Selectable,
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
		if m.confirming {
			switch msg.String() {
			case "y", "enter":
				m.confirming = false
				m.submitted = true
				return m, tea.Quit
			case "n", "esc":
				// Back to the table so a different application can be picked.
				m.confirming = false
				return m, nil
			case "ctrl+c", "q":
				return m, tea.Quit
			}
			return m, nil
		}

		switch msg.String() {
		case "ctrl+c", "q", "esc":
			return m, tea.Quit
		case "enter":
			if m.selectable {
				if m.confirm != nil {
					m.confirming = true
					return m, nil
				}
				m.submitted = true
				return m, tea.Quit
			}
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

	body := strings.Split(tableBox.Render(m.table.View()), "\n")
	if m.confirming {
		body = overlay(body, strings.Split(m.confirmModal(), "\n"))
	}
	b.WriteString(strings.Join(body, "\n"))

	b.WriteString("\n")
	help := m.help
	switch {
	case m.confirming:
		help = "y/enter  confirm • n/esc  back"
	case help == "":
		help = "↑/k up • ↓/j down • q quit"
	}
	b.WriteString(styles.Boundary(m.width, help, styles.FormFooterStyle, styles.FormBoundaryFillStyle))
	return b.String()
}

// confirmModal is the overlay asking the user to confirm the highlighted row.
func (m *TableModel) confirmModal() string {
	question := "Are you sure?"
	if m.confirm != nil {
		if row := m.table.SelectedRow(); row != nil {
			question = m.confirm(row)
		}
	}

	box := styles.ModalStyle.Render(
		lipgloss.NewStyle().Bold(true).Foreground(styles.LightGrayColor).Render(question) +
			"\n\n" +
			lipgloss.NewStyle().Foreground(styles.MutedColor).Render("y/enter  confirm      n/esc  back"),
	)

	// Centre the box in a block as wide as the table so it lines up with it.
	return lipgloss.Place(m.width, lipgloss.Height(box), lipgloss.Center, lipgloss.Center, box)
}

// overlay centres box over lines, replacing the rows it covers while leaving
// the table visible above and below it.
func overlay(lines, box []string) []string {
	out := append([]string(nil), lines...)
	start := (len(out) - len(box)) / 2
	if start < 0 {
		start = 0
	}
	for len(out) < start+len(box) {
		out = append(out, "")
	}
	for i := range box {
		out[start+i] = box[i]
	}
	return out
}

// SelectedRow returns the row under the cursor, or nil when there is none.
func (m *TableModel) SelectedRow() table.Row {
	return m.table.SelectedRow()
}

// Submitted reports whether the user confirmed a row with Enter rather than
// quitting out of the table.
func (m *TableModel) Submitted() bool {
	return m.submitted
}
