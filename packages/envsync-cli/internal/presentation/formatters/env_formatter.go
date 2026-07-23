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

func (f *EnvFormatter) FormatEnvList(writer io.Writer, envs []domain.EnvType) error {
	if len(envs) == 0 {
		_, err := writer.Write([]byte("📭 No environments found.\n"))
		return err
	}

	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("\n📋 Environments (%d)\n", len(envs)))
	sb.WriteString(strings.Repeat("─", 80) + "\n")
	sb.WriteString(fmt.Sprintf("%-36s %-20s %-10s %-10s\n", "ID", "NAME", "DEFAULT", "PROTECTED"))
	sb.WriteString(strings.Repeat("─", 80) + "\n")

	for _, env := range envs {
		isDefault := "no"
		if env.IsDefault {
			isDefault = "yes"
		}
		isProtected := "no"
		if env.IsProtected {
			isProtected = "yes"
		}
		sb.WriteString(fmt.Sprintf("%-36s %-20s %-10s %-10s\n", env.ID, truncate(env.Name, 18), isDefault, isProtected))
	}

	sb.WriteString(strings.Repeat("─", 80) + "\n")

	_, err := writer.Write([]byte(sb.String()))
	return err
}
