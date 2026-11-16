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
	var sb strings.Builder

	sb.WriteString(style.SuccessStyle.Render("✅ Application created successfully!") + "\n\n")
	sb.WriteString(fmt.Sprintf("📛 Name: %s\n", app.Name))
	sb.WriteString(fmt.Sprintf("🆔 ID: %s\n", app.ID))
	if app.Description != "" {
		sb.WriteString(fmt.Sprintf("📝 Description: %s\n", app.Description))
	}
	sb.WriteString(fmt.Sprintf("🔐 Secrets: %s\n", secretsStatus(app)))

	if len(app.EnvTypes) > 0 {
		names := make([]string, 0, len(app.EnvTypes))
		for _, t := range app.EnvTypes {
			names = append(names, t.Name)
		}
		sb.WriteString(fmt.Sprintf("🌍 Environment types: %s\n", strings.Join(names, ", ")))
	}

	sb.WriteString("\nNext: envsync env list --app-id " + app.ID + "\n")

	_, err := writer.Write([]byte(style.Render(style.BoxStyle, sb.String())))
	return err
}

// secretsStatus describes how the application's secret encryption is managed.
func secretsStatus(app domain.Application) string {
	switch {
	case !app.EnableSecrets:
		return "disabled"
	case app.IsManagedSecret:
		return "enabled — key generated and managed by EnvSync"
	default:
		return "enabled — using your public key"
	}
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
