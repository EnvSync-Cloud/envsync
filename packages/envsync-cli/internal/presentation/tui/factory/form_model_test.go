package factory

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/huh"
	"github.com/charmbracelet/lipgloss"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/styles"
)

// Regression: the form model wraps the form in a header and help footer, but
// the form was sized to the full terminal height. Tall fields (the file picker
// zooms to the form height) then pushed the frame past the help text and off
// the screen.
func TestFormModelFrameFitsTerminal(t *testing.T) {
	for _, height := range []int{24, 40} {
		filePath := ""
		mode := "binary"
		picker := huh.NewFilePicker().
			Title("File").
			Description("Select the file to sign.").
			FileAllowed(true).
			DirAllowed(false).
			Value(&filePath)
		form := huh.NewForm(
			huh.NewGroup(
				&boundedFilePicker{FilePicker: picker, max: 12},
				huh.NewSelect[string]().
					Title("Mode").
					Options(huh.NewOption("binary", "binary"), huh.NewOption("text", "text")).
					Value(&mode),
			),
		).WithTheme(styles.FormTheme()).WithShowHelp(false)

		var model tea.Model = formModel{form: form, title: "Sign with GPG key", width: 100}
		model, _ = model.Update(tea.WindowSizeMsg{Width: 100, Height: height})

		// Opening the picker zooms the field to the form height.
		_, cmd := model.Update(tea.KeyMsg{Type: tea.KeyEnter})
		if cmd != nil {
			if msg := cmd(); msg != nil {
				model, _ = model.Update(msg)
			}
		}

		// Repeated size messages (terminal resizes, tmux redraws) ratcheted the
		// zoomed picker taller every time until the frame ran past the help
		// text. The frame must stay within the terminal through all of them.
		for range 15 {
			model, _ = model.Update(tea.WindowSizeMsg{Width: 100, Height: height})
		}

		view := model.(formModel).View()
		if got := lipgloss.Height(view); got > height {
			t.Errorf("terminal %d rows: frame is %d lines, want <= %d", height, got, height)
		}

		// The picker box must render complete (its closing border) and the help
		// footer must be the last thing on screen — the reported bug was the
		// picker's viewport continuing below the help line.
		lines := strings.Split(view, "\n")
		closed := false
		for _, line := range lines {
			if strings.Contains(line, "╰") {
				closed = true
			}
		}
		if !closed {
			t.Errorf("terminal %d rows: picker box never closed with a bottom border", height)
		}
		last := ""
		for _, line := range lines {
			if strings.TrimSpace(line) != "" {
				last = line
			}
		}
		if !strings.Contains(last, "esc close") {
			t.Errorf("terminal %d rows: help footer is not the last line, got %q", height, last)
		}
	}
}
