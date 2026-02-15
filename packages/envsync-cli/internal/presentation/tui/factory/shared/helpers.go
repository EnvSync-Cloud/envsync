package shared

import (
	"fmt"
	"strings"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
)

// FormatAppDescription formats an app description with truncation
func FormatAppDescription(desc string, maxLength int) string {
	if desc == "" {
		return "No description"
	}
	if len(desc) > maxLength {
		return desc[:maxLength-3] + "..."
	}
	return desc
}

// FormatAppLabel creates a formatted label for app selection
func FormatAppLabel(app domain.Application, maxDescLength int) string {
	desc := FormatAppDescription(app.Description, maxDescLength)
	return fmt.Sprintf("%s - %s", app.Name, desc)
}

// FormatAppDetails creates a formatted string with app details
func FormatAppDetails(app domain.Application) string {
	var details strings.Builder

	details.WriteString(fmt.Sprintf("📛 Name: %s\n", app.Name))
	details.WriteString(fmt.Sprintf("🆔 ID: %s\n", app.ID))

	if app.Description != "" {
		details.WriteString(fmt.Sprintf("📝 Description: %s\n", app.Description))
	}

	if app.EnvCount != "" && app.EnvCount != "0" {
		details.WriteString(fmt.Sprintf("🌍 Environments: %s\n", app.EnvCount))
	}

	return details.String()
}

// FormatAppListItem creates a formatted list item for an app
func FormatAppListItem(app domain.Application, cursor string, prefix string) string {
	var item strings.Builder

	item.WriteString(fmt.Sprintf("%s%s📛 %s\n", cursor, prefix, app.Name))
	item.WriteString(fmt.Sprintf("%s  🆔 ID: %s\n", strings.Repeat(" ", len(cursor)), app.ID))

	if app.Description != "" {
		desc := FormatAppDescription(app.Description, 60)
		item.WriteString(fmt.Sprintf("%s  📝 %s\n", strings.Repeat(" ", len(cursor)), desc))
	}

	if app.EnvCount != "" && app.EnvCount != "0" {
		item.WriteString(fmt.Sprintf("%s  🌍 %s environments\n", strings.Repeat(" ", len(cursor)), app.EnvCount))
	}

	return item.String()
}

// GetSelectedApps returns the list of selected applications
func GetSelectedApps(apps []domain.Application, selected map[int]bool) []domain.Application {
	var selectedApps []domain.Application
	for i, app := range apps {
		if selected[i] {
			selectedApps = append(selectedApps, app)
		}
	}
	return selectedApps
}

// CountSelected returns the number of selected items
func CountSelected(selected map[int]bool) int {
	count := 0
	for _, isSelected := range selected {
		if isSelected {
			count++
		}
	}
	return count
}

// SelectAll selects all items in the map
func SelectAll(apps []domain.Application) map[int]bool {
	selected := make(map[int]bool)
	for i := range apps {
		selected[i] = true
	}
	return selected
}

// SelectNone clears all selections
func SelectNone() map[int]bool {
	return make(map[int]bool)
}

// ToggleSelection toggles the selection state of an item
func ToggleSelection(selected map[int]bool, index int) {
	selected[index] = !selected[index]
}

// NavigationHelp returns common navigation help text
func NavigationHelp() string {
	return "Use ↑/↓ (or j/k) to navigate, q to quit"
}

// MultiSelectHelp returns multi-select help text
func MultiSelectHelp() string {
	return "SPACE to select/deselect, 'a' to select all, 'n' to select none"
}

// ConfirmationHelp returns confirmation help text
func ConfirmationHelp() string {
	return "Use ←/→ to select, ENTER to confirm, ESC to go back"
}
