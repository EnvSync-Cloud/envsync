package factory

import (
	"fmt"
	"testing"

	"github.com/charmbracelet/huh"
	"github.com/charmbracelet/lipgloss"
	tea "github.com/charmbracelet/bubbletea"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/styles"
)

// Replicates the SignKeyTUI form exactly and prints the zoomed frame's layout.
func TestProbeSignFormLayout(t *testing.T) {
	filePath := ""
	mode := "binary"
	detached := true
	output := ""

	labels := make([]huh.Option[string], 0, len(domain.SignModes()))
	for _, m := range domain.SignModes() {
		labels = append(labels, huh.NewOption(m, m))
	}

	details := huh.NewGroup(
		huh.NewFilePicker().
			Title("File").
			Description("Select the file to sign.").
			ShowSize(true).
			FileAllowed(true).
			DirAllowed(false).
			Value(&filePath),
		huh.NewSelect[string]().
			Title("Mode").
			Description("How the data should be signed.").
			Options(labels...).
			Value(&mode),
	).Title("Signing details")

	options := huh.NewGroup(
		huh.NewConfirm().
			Title("Detached signature?").
			Value(&detached),
		huh.NewInput().
			Title("Output path").
			Value(&output),
	).Title("Output")

	form := huh.NewForm(details, options).
		WithTheme(styles.FormTheme()).
		WithShowHelp(false)

	var model tea.Model = formModel{form: form, title: "Sign with GPG key", width: 80}
	model, _ = model.Update(tea.WindowSizeMsg{Width: 80, Height: 24})
	_, cmd := model.Update(tea.KeyMsg{Type: tea.KeyEnter}) // open the picker
	if cmd != nil {
		if msg := cmd(); msg != nil {
			model, _ = model.Update(msg)
		}
	}

	view := model.(formModel).View()
	for i, line := range splitLines(view) {
		fmt.Printf("%02d|%s\n", i+1, line)
	}
	fmt.Println("TOTAL LINES:", lipgloss.Height(view), "TERMINAL: 24")
}

func splitLines(s string) []string {
	out := []string{}
	cur := ""
	for _, r := range s {
		if r == '\n' {
			out = append(out, cur)
			cur = ""
			continue
		}
		cur += string(r)
	}
	out = append(out, cur)
	return out
}
