package style

import "github.com/charmbracelet/lipgloss"

// Color palette
var (
	// Primary colors from existing brand
	PrimaryColor   = lipgloss.Color("#89F336")
	SecondaryColor = lipgloss.Color("#7C3AED")
	AccentColor    = lipgloss.Color("#F59E0B")

	// Status colors
	SuccessColor = lipgloss.Color("#10B981")
	ErrorColor   = lipgloss.Color("#EF4444")
	WarningColor = lipgloss.Color("#F59E0B")
	InfoColor    = lipgloss.Color("#3B82F6")

	// Neutral colors
	MutedColor     = lipgloss.Color("#6B7280")
	LightGrayColor = lipgloss.Color("#E5E7EB")
	DarkGrayColor  = lipgloss.Color("#374151")

	// Background colors
	SelectedBgColor = lipgloss.Color("#1E1B4B")
	HoverBgColor    = lipgloss.Color("#312E81")
)

// Layout styles
var (
	// Borders
	RoundedBorder = lipgloss.RoundedBorder()
	ThickBorder   = lipgloss.ThickBorder()
	DoubleBorder  = lipgloss.DoubleBorder()

	// Base box style
	BoxStyle = lipgloss.NewStyle().
			BorderStyle(RoundedBorder).
			BorderForeground(PrimaryColor).
			Padding(1, 2).
			Margin(0, 1, 1, 0)

	// Selected box style
	SelectedBoxStyle = BoxStyle.
				BorderForeground(SecondaryColor).
				Background(SelectedBgColor)

	// Hover box style
	HoverBoxStyle = BoxStyle.
			BorderForeground(AccentColor).
			Background(HoverBgColor)

	LinkStyle = lipgloss.NewStyle().
			Foreground(AccentColor)
)

// Text styles
var (
	// Headers
	HeaderStyle = lipgloss.NewStyle().
			Foreground(PrimaryColor).
			Bold(true).
			Margin(1, 0).
			Padding(0, 1)

	SubHeaderStyle = lipgloss.NewStyle().
			Foreground(SecondaryColor).
			Bold(true).
			Margin(0, 0, 1, 0)

	// Title styles
	TitleStyle = lipgloss.NewStyle().
			Foreground(PrimaryColor).
			Bold(true)

	SubtitleStyle = lipgloss.NewStyle().
			Foreground(MutedColor).
			Italic(true)

	// Content styles
	ContentStyle = lipgloss.NewStyle().
			Foreground(LightGrayColor)

	DescriptionStyle = lipgloss.NewStyle().
				Foreground(MutedColor)

	// Status styles
	SuccessStyle = lipgloss.NewStyle().
			Foreground(SuccessColor).
			Bold(true)

	ErrorStyle = lipgloss.NewStyle().
			Foreground(ErrorColor)

	WarningStyle = lipgloss.NewStyle().
			Foreground(WarningColor).
			Bold(true)

	InfoStyle = lipgloss.NewStyle().
			Foreground(InfoColor).
			Bold(true)

	// Interactive styles
	FocusedStyle = lipgloss.NewStyle().
			Foreground(PrimaryColor).
			Bold(true)

	BlurredStyle = lipgloss.NewStyle().
			Foreground(MutedColor)

	// Help text
	HelpStyle = lipgloss.NewStyle().
			Foreground(MutedColor).
			Margin(1, 0)

	// Key bindings
	KeyStyle = lipgloss.NewStyle().
			Foreground(PrimaryColor).
			Bold(true)

	KeyDescStyle = lipgloss.NewStyle().
			Foreground(MutedColor)
)

// Form styles
var (
	// Input styles
	InputStyle = lipgloss.NewStyle().
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(MutedColor).
			Padding(0, 1)

	FocusedInputStyle = InputStyle.
				BorderForeground(PrimaryColor)

	// Label styles
	LabelStyle = lipgloss.NewStyle().
			Foreground(LightGrayColor).
			Bold(true).
			Margin(0, 0, 0, 1)

	RequiredLabelStyle = LabelStyle.
				Foreground(ErrorColor)

	// Button styles
	ButtonStyle = lipgloss.NewStyle().
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(PrimaryColor).
			Foreground(PrimaryColor).
			Padding(0, 2).
			Margin(0, 1)

	ActiveButtonStyle = ButtonStyle.
				Background(PrimaryColor).
				Foreground(lipgloss.Color("#000000")).
				Bold(true)

	DisabledButtonStyle = ButtonStyle.Copy().
				BorderForeground(MutedColor).
				Foreground(MutedColor)
)

// List styles
var (
	// List item styles
	ListItemStyle = lipgloss.NewStyle().
			Padding(0, 2)

	SelectedListItemStyle = ListItemStyle.
				Background(SelectedBgColor).
				Foreground(PrimaryColor).
				Bold(true)

	// Cursor styles
	CursorStyle = lipgloss.NewStyle().
			Foreground(PrimaryColor).
			Bold(true)

	// Checkbox styles
	CheckboxStyle = lipgloss.NewStyle().
			Foreground(SuccessColor).
			Bold(true)

	UncheckedStyle = lipgloss.NewStyle().
			Foreground(MutedColor)
)

// Progress styles
var (
	ProgressBarStyle = lipgloss.NewStyle().
				BorderStyle(lipgloss.RoundedBorder()).
				BorderForeground(PrimaryColor).
				Padding(0, 1)

	ProgressFillStyle = lipgloss.NewStyle().
				Background(PrimaryColor).
				Foreground(lipgloss.Color("#000000"))

	SpinnerStyle = lipgloss.NewStyle().
			Foreground(PrimaryColor).
			Bold(true)
)

// Modal styles
var (
	ModalStyle = lipgloss.NewStyle().
			BorderStyle(lipgloss.ThickBorder()).
			BorderForeground(PrimaryColor).
			Background(lipgloss.Color("#1F2937")).
			Padding(2, 4).
			Margin(2, 4)

	OverlayStyle = lipgloss.NewStyle().
			Background(lipgloss.Color("#00000080"))
)

// Utility functions
func WithEmoji(emoji, text string) string {
	return emoji + " " + text
}

func Highlight(text string) lipgloss.Style {
	return lipgloss.NewStyle().
		Background(AccentColor).
		Foreground(lipgloss.Color("#000000")).
		Bold(true).
		Padding(0, 1)
}

func Dimmed(text string) string {
	return lipgloss.NewStyle().Foreground(MutedColor).Render(text)
}

func Bold(text string) string {
	return lipgloss.NewStyle().Bold(true).Render(text)
}

func Italic(text string) string {
	return lipgloss.NewStyle().Italic(true).Render(text)
}
