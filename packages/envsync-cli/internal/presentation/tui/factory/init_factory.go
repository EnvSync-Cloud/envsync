package factory

import (
	"fmt"

	"github.com/charmbracelet/bubbles/table"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/component"
)

type InitFactory struct{}

func NewInitFactory() *InitFactory {
	return &InitFactory{}
}

// PickApp shows the applications in a table and returns the one the user
// submits. ok is false when they quit without choosing.
func (f *InitFactory) PickApp(apps []domain.Application) (domain.Application, bool, error) {
	row, ok, err := selectRow(component.TableConfig{
		Title:   "Select an application",
		Columns: appTableColumns(),
		Rows:    appTableRows(apps),
		Width:   108,
		Height:  24,
		Help:    "↑/k up • ↓/j down • enter select • q cancel",
	})
	if !ok || err != nil {
		return domain.Application{}, ok, err
	}

	// Match on the ID cell rather than the cursor position.
	for _, a := range apps {
		if a.ID == row[1] {
			return a, true, nil
		}
	}

	return domain.Application{}, false, fmt.Errorf("selected application %q is no longer available", row[1])
}

// PickEnvType shows an application's environment types and returns the one the
// user submits. ok is false when they quit without choosing.
func (f *InitFactory) PickEnvType(envTypes []domain.EnvType, appName string) (domain.EnvType, bool, error) {
	rows := make([]table.Row, 0, len(envTypes))
	for _, e := range envTypes {
		rows = append(rows, table.Row{e.Name, e.ID})
	}

	row, ok, err := selectRow(component.TableConfig{
		Title: fmt.Sprintf("Select an environment for %s", appName),
		Columns: []table.Column{
			{Title: "NAME", Width: 28},
			{Title: "ID", Width: 24},
		},
		Rows:   rows,
		Width:  64,
		Height: 24,
		Help:   "↑/k up • ↓/j down • enter select • q cancel",
	})
	if !ok || err != nil {
		return domain.EnvType{}, ok, err
	}

	for _, e := range envTypes {
		if e.ID == row[1] {
			return e, true, nil
		}
	}

	return domain.EnvType{}, false, fmt.Errorf("selected environment %q is no longer available", row[1])
}
