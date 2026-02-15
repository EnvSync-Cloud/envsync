package formatters

import (
	"encoding/json"
	"fmt"
	"io"

	"github.com/EnvSync-Cloud/envsync-cli/internal/presentation/style"
)

type BaseFormatter struct{}

func NewBaseFormatter() *BaseFormatter {
	return &BaseFormatter{}
}

func (f *BaseFormatter) FormatJSON(writer io.Writer, data any) error {
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal applications to JSON: %w", err)
	}

	_, err = writer.Write(jsonData)
	if err != nil {
		return fmt.Errorf("failed to write JSON output: %w", err)
	}

	// Add newline for better formatting
	_, err = writer.Write([]byte("\n"))
	return err
}

func (f *BaseFormatter) FormatJSONError(writer io.Writer, err error) error {
	jsonError := map[string]string{
		"error": err.Error(),
	}
	return f.FormatJSON(writer, jsonError)
}

func (f *BaseFormatter) FormatWarningJSON(writer io.Writer, message string) error {
	jsonWarning := map[string]string{
		"warning": message,
	}
	return f.FormatJSON(writer, jsonWarning)
}

func (f *BaseFormatter) FormatSuccess(writer io.Writer, message string) error {
	output := style.BoxStyle.Render(style.SuccessStyle.Render(fmt.Sprintf("✅ %s\n", message)))
	_, err := writer.Write([]byte(output))
	return err
}

// FormatError formats error messages
func (f *BaseFormatter) FormatError(writer io.Writer, message string) error {
	output := style.ErrorStyle.Render(fmt.Sprintf("❎ %s\n", message))
	_, err := writer.Write([]byte(output))
	return err
}

// FormatWarning formats warning messages
func (f *BaseFormatter) FormatWarning(writer io.Writer, message string) error {
	output := style.WarningStyle.Render(fmt.Sprintf("⚠️  %s\n", message))
	_, err := writer.Write([]byte(output))
	return err
}
