package formatters

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/style"
)

type SyncFormatter struct {
	*BaseFormatter
}

func NewSyncFormatter() *SyncFormatter {
	base := NewBaseFormatter()
	return &SyncFormatter{
		BaseFormatter: base,
	}
}

func (f *SyncFormatter) FormatVariableDetails(added, updated, deleted int) {
	if added == 0 && updated == 0 && deleted == 0 {
		fmt.Println(style.SuccessStyle.Render("✓ No changes detected during sync."))
		return
	}

	s := strings.Builder{}
	if added > 0 {
		s.WriteString("Added: ")
		s.WriteString(strconv.Itoa(added))
		s.WriteString(" ")
	}
	if updated > 0 {
		s.WriteString("Updated: ")
		s.WriteString(strconv.Itoa(updated))
		s.WriteString(" ")
	}
	if deleted > 0 {
		s.WriteString("Deleted: ")
		s.WriteString(strconv.Itoa(deleted))
		s.WriteString(" ")
	}

	fmt.Println(style.SuccessStyle.Render("✓ " + s.String() + "variables · "))
}
