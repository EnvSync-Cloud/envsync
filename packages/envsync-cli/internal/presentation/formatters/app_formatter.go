package formatters

import (
	"fmt"
	"io"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/presentation/style"
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

	// TODO: Print metadata

	_, err := writer.Write([]byte(successMsg))

	return err
}
