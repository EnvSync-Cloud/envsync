package component

import (
	"testing"

	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
)

func newTable(selectable bool) *TableModel {
	return NewTableModel(TableConfig{
		Title: "Applications",
		Columns: []table.Column{
			{Title: "NAME", Width: 10},
			{Title: "ID", Width: 8},
		},
		Rows: []table.Row{
			{"alpha", "a1"},
			{"beta", "b2"},
		},
		Width:      30,
		Height:     10,
		Selectable: selectable,
	})
}

// Regression: the app delete picker needs Enter to confirm the highlighted row
// and to tell the caller that the user chose rather than quit.
func TestTableEnterSubmitsWhenSelectable(t *testing.T) {
	m := newTable(true)

	if m.SelectedRow()[1] != "a1" {
		t.Fatalf("cursor starts on %v, want the first row", m.SelectedRow())
	}

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyDown})
	model := updated.(*TableModel)
	if model.SelectedRow()[1] != "b2" {
		t.Fatalf("cursor after down = %v, want the second row", model.SelectedRow())
	}

	updated, _ = model.Update(tea.KeyMsg{Type: tea.KeyEnter})
	model = updated.(*TableModel)

	if !model.Submitted() {
		t.Error("Enter did not mark the table as submitted")
	}
	if model.SelectedRow()[1] != "b2" {
		t.Errorf("submitted row = %v, want the highlighted row", model.SelectedRow())
	}
}

// A browse-only table must not treat Enter as a selection.
func TestTableEnterDoesNotSubmitWhenNotSelectable(t *testing.T) {
	m := newTable(false)

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if updated.(*TableModel).Submitted() {
		t.Error("Enter submitted a non-selectable table")
	}
}

// Quitting must never look like a submission, or the caller would delete
// whatever happened to be under the cursor.
func TestTableQuitDoesNotSubmit(t *testing.T) {
	for _, key := range []tea.KeyMsg{
		{Type: tea.KeyEsc},
		{Type: tea.KeyCtrlC},
		{Type: tea.KeyRunes, Runes: []rune{'q'}},
	} {
		m := newTable(true)
		updated, _ := m.Update(key)
		if updated.(*TableModel).Submitted() {
			t.Errorf("%q reported as a submission", key.String())
		}
	}
}

// When a confirm is configured, Enter opens the overlay and only an accepted
// prompt may reach the caller as a submission.
func TestTableConfirmGatesSubmission(t *testing.T) {
	start := func() *TableModel {
		m := newTable(true)
		m.confirm = func(table.Row) string { return "Delete it?" }
		return m
	}

	updated, _ := start().Update(tea.KeyMsg{Type: tea.KeyEnter})
	model := updated.(*TableModel)
	if model.Submitted() {
		t.Fatal("Enter submitted without confirming")
	}
	if !model.confirming {
		t.Fatal("Enter did not open the confirmation overlay")
	}

	// Declining goes back to the table and must not submit.
	updated, _ = model.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'n'}})
	model = updated.(*TableModel)
	if model.Submitted() {
		t.Error("declining the prompt still submitted")
	}
	if model.confirming {
		t.Error("declining left the confirmation overlay open")
	}

	// Accepting submits.
	updated, _ = model.Update(tea.KeyMsg{Type: tea.KeyEnter})
	model = updated.(*TableModel)
	updated, _ = model.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'y'}})
	if !updated.(*TableModel).Submitted() {
		t.Error("confirming did not submit")
	}
}

// A short list must still read as a table, and a longer one must grow to show
// every row until the terminal runs out of room.
func TestTableBodyHeight(t *testing.T) {
	tests := []struct {
		name     string
		rows     int
		term     int
		wantRows int // visible data rows, excluding the header
	}{
		{name: "short list is padded to five rows", rows: 2, term: 40, wantRows: 5},
		{name: "five rows fit exactly", rows: 5, term: 40, wantRows: 5},
		{name: "longer list grows to fit", rows: 9, term: 40, wantRows: 9},
		{name: "terminal caps the height", rows: 30, term: 12, wantRows: 7},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rows := make([]table.Row, 0, tc.rows)
			for range tc.rows {
				rows = append(rows, table.Row{"x", "y"})
			}

			m := NewTableModel(TableConfig{
				Columns: []table.Column{{Title: "A", Width: 4}, {Title: "B", Width: 4}},
				Rows:    rows,
				Width:   20,
				Height:  tc.term,
			})

			if got := m.bodyHeight(tc.term) - 1; got != tc.wantRows {
				t.Errorf("visible data rows = %d, want %d", got, tc.wantRows)
			}
		})
	}
}
