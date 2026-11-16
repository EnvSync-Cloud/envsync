package formatters

import (
	"io"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/style"
)

type RunFormatter struct {
	*BaseFormatter
}

func NewRunFormatter() *RunFormatter {
	return &RunFormatter{
		BaseFormatter: NewBaseFormatter(),
	}
}

func (f *RunFormatter) FormatLog(writer io.Writer, str string) error {
	out := style.SuccessStyle.Render("✓ "+str) + "\n"
	_, err := writer.Write([]byte(out))
	return err
}

func (f *RunFormatter) FormatRunningStatus(writer io.Writer) error {
	out := style.SuccessStyle.Render("→ Application running...") + "\n"
	_, err := writer.Write([]byte(out))
	return err
}
