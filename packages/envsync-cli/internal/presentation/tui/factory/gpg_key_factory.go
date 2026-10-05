package factory

import (
	"fmt"

	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/component"
)

type GpgKeyFactory struct{}

func NewGpgKeyFactory() *GpgKeyFactory {
	return &GpgKeyFactory{}
}

// gpgKeyTableColumns are the columns shared by every GPG key table.
func gpgKeyTableColumns() []table.Column {
	return []table.Column{
		{Title: "ID", Width: 36},
		{Title: "NAME", Width: 20},
		{Title: "EMAIL", Width: 30},
		{Title: "FINGERPRINT", Width: 16},
		{Title: "ALGORITHM", Width: 10},
		{Title: "STATUS", Width: 8},
	}
}

// gpgKeyTableRows projects GPG keys onto those columns. Cell values come from
// the formatter so the interactive and plain tables always agree.
func gpgKeyTableRows(keys []domain.GpgKey) []table.Row {
	rows := make([]table.Row, 0, len(keys))
	for _, k := range keys {
		rows = append(rows, table.Row{
			k.ID, k.Name, k.Email,
			formatters.ShortFingerprint(k.Fingerprint),
			k.Algorithm,
			formatters.GpgKeyStatus(k),
		})
	}
	return rows
}

// ListKeysInteractive runs the interactive GPG key listing flow
func (f *GpgKeyFactory) ListKeysInteractive(keys []domain.GpgKey) error {
	model := component.NewTableModel(component.TableConfig{
		Title:   "GPG Keys",
		Columns: gpgKeyTableColumns(),
		Rows:    gpgKeyTableRows(keys),
		Width:   140,
		Height:  24,
	})

	// No alt screen: the table renders inline rather than taking over the
	// terminal.
	if _, err := tea.NewProgram(model).Run(); err != nil {
		return fmt.Errorf("error running gpg key list TUI: %w", err)
	}

	return nil
}
