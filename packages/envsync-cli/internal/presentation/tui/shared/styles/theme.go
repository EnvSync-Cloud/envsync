package styles

import "github.com/charmbracelet/lipgloss"

// This file exists to resolve import references.
// The main theme definitions are in internal/presentation/tui/styles/theme.go

// Re-export commonly used styles from the main theme file
var (
	// Basic color palette
	PrimaryColor   = lipgloss.Color("#89F336")
	SecondaryColor = lipgloss.Color("#7C3AED")
	AccentColor    = lipgloss.Color("#F59E0B")
)
