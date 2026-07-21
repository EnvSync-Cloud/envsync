package formatters

import (
	"fmt"
	"io"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
)

type EnvFormatter struct {
	*BaseFormatter
}

func NewEnvFormatter() *EnvFormatter {
	base := NewBaseFormatter()
	return &EnvFormatter{
		BaseFormatter: base,
	}
}

// FormatListTable prints application environment types (dev/stage/prod, etc.).
func (f *EnvFormatter) FormatListTable(writer io.Writer, envs []domain.EnvType) error {
	if len(envs) == 0 {
		_, err := writer.Write([]byte("📭 No environments found for this application.\n"))
		return err
	}

	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("\n🌍 Environments (%d)\n", len(envs)))
	sb.WriteString(strings.Repeat("─", 100) + "\n")
	sb.WriteString(fmt.Sprintf("%-36s %-20s %-10s %-12s %-10s\n", "ID", "NAME", "DEFAULT", "PROTECTED", "COLOR"))
	sb.WriteString(strings.Repeat("─", 100) + "\n")

	for _, env := range envs {
		sb.WriteString(fmt.Sprintf(
			"%-36s %-20s %-10s %-12s %-10s\n",
			env.ID,
			truncate(env.Name, 18),
			boolLabel(env.IsDefault),
			boolLabel(env.IsProtected),
			truncate(env.Color, 10),
		))
	}

	sb.WriteString(strings.Repeat("─", 100) + "\n")

	_, err := writer.Write([]byte(sb.String()))
	return err
}

func boolLabel(v bool) string {
	if v {
		return "yes"
	}
	return "no"
}
