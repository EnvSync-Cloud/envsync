package formatters

import (
	"fmt"
	"io"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/style"
)

type AppFormatter struct {
	*BaseFormatter
}

func NewAppFormatter() *AppFormatter {
	base := NewBaseFormatter()
	return &AppFormatter{
		BaseFormatter: base,
	}
}

func (f *AppFormatter) FormatCreateSuccessMessage(writer io.Writer, app domain.Application) error {
	successMsg := fmt.Sprintf("✅ Application '%s' created successfully!\n\n", app.Name)
	successMsg += fmt.Sprintf("📛 Name: %s\n", app.Name)
	successMsg += fmt.Sprintf("🆔 ID: %s\n", app.ID)
	if app.Description != "" {
		successMsg += fmt.Sprintf("📝 Description: %s\n", app.Description)
	}

	successMsg = style.BoxStyle.Render(successMsg)

	_, err := writer.Write([]byte(successMsg))

	return err
}

func (f *AppFormatter) FormatListTable(writer io.Writer, apps []domain.Application) error {
	if len(apps) == 0 {
		_, err := writer.Write([]byte("📭 No applications found.\n"))
		return err
	}

	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("\n📋 Applications (%d)\n", len(apps)))
	sb.WriteString(strings.Repeat("─", 80) + "\n")
	sb.WriteString(fmt.Sprintf("%-36s %-20s %-20s\n", "ID", "NAME", "ENVIRONMENTS"))
	sb.WriteString(strings.Repeat("─", 80) + "\n")

	for _, app := range apps {
		envCount := fmt.Sprintf("%d", len(app.EnvTypes))
		if app.EnvCount != "" {
			envCount = app.EnvCount
		}
		sb.WriteString(fmt.Sprintf("%-36s %-20s %-20s\n", app.ID, truncate(app.Name, 18), envCount))
	}

	sb.WriteString(strings.Repeat("─", 80) + "\n")

	_, err := writer.Write([]byte(sb.String()))
	return err
}
