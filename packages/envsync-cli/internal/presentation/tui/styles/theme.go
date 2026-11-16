package styles

import (
	"strings"

	"github.com/charmbracelet/huh"
	"github.com/charmbracelet/lipgloss"
)

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
			Foreground(ErrorColor).
			Bold(true)

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
			Padding(1, 3)

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

// Form chrome: the slash boundary header and footer that frame the interactive
// forms.
var (
	FormHeaderStyle = lipgloss.NewStyle().
			Foreground(PrimaryColor).
			Bold(true).
			Padding(0, 1)

	FormFooterStyle = lipgloss.NewStyle().
			Foreground(MutedColor).
			Padding(0, 1)

	FormBoundaryFillStyle = lipgloss.NewStyle().
				Foreground(SecondaryColor)
)

// Boundary renders text left-aligned followed by a slash fill that pads the
// line out to exactly width cells: "Create application ////…".
func Boundary(width int, text string, textStyle, fillStyle lipgloss.Style) string {
	head := textStyle.Render(text)
	fill := width - lipgloss.Width(head)
	if fill < 0 {
		fill = 0
	}
	return head + fillStyle.Render(strings.Repeat("/", fill))
}

// FormTheme returns the huh theme used by the interactive forms.
//
// Every field is boxed in a rounded border. The focused field is accented in
// the brand purple and the rest fall back to a muted border, so the active
// field is always obvious without relying on colour alone.
func FormTheme() *huh.Theme {
	t := huh.ThemeBase()

	box := lipgloss.NewStyle().
		BorderStyle(lipgloss.RoundedBorder()).
		Padding(0, 1)

	t.Focused.Base = box.BorderForeground(SecondaryColor)
	t.Blurred.Base = box.BorderForeground(DarkGrayColor)

	t.Focused.Title = lipgloss.NewStyle().Foreground(PrimaryColor).Bold(true)
	t.Blurred.Title = lipgloss.NewStyle().Foreground(MutedColor).Bold(true)

	t.Focused.Description = lipgloss.NewStyle().Foreground(MutedColor)
	t.Blurred.Description = lipgloss.NewStyle().Foreground(DarkGrayColor)

	t.Focused.TextInput.Text = lipgloss.NewStyle().Foreground(LightGrayColor)
	t.Blurred.TextInput.Text = lipgloss.NewStyle().Foreground(MutedColor)
	t.Focused.TextInput.Placeholder = lipgloss.NewStyle().Foreground(DarkGrayColor).Italic(true)
	t.Blurred.TextInput.Placeholder = lipgloss.NewStyle().Foreground(DarkGrayColor).Italic(true)
	t.Focused.TextInput.Prompt = lipgloss.NewStyle().Foreground(SecondaryColor)
	t.Blurred.TextInput.Prompt = lipgloss.NewStyle().Foreground(DarkGrayColor)
	t.Focused.TextInput.Cursor = lipgloss.NewStyle().Background(PrimaryColor).Foreground(lipgloss.Color("#000000"))
	t.Blurred.TextInput.Cursor = lipgloss.NewStyle()

	t.Focused.SelectSelector = lipgloss.NewStyle().Foreground(SecondaryColor).Bold(true)
	t.Blurred.SelectSelector = lipgloss.NewStyle().Foreground(DarkGrayColor)
	t.Focused.SelectedOption = lipgloss.NewStyle().Foreground(PrimaryColor)
	t.Focused.UnselectedOption = lipgloss.NewStyle().Foreground(LightGrayColor)
	t.Blurred.SelectedOption = lipgloss.NewStyle().Foreground(MutedColor)
	t.Blurred.UnselectedOption = lipgloss.NewStyle().Foreground(DarkGrayColor)

	t.Focused.MultiSelectSelector = lipgloss.NewStyle().Foreground(SecondaryColor).Bold(true)
	t.Blurred.MultiSelectSelector = lipgloss.NewStyle().Foreground(DarkGrayColor)
	t.Focused.SelectedPrefix = lipgloss.NewStyle().Foreground(PrimaryColor)
	t.Focused.UnselectedPrefix = lipgloss.NewStyle().Foreground(DarkGrayColor)
	t.Blurred.SelectedPrefix = lipgloss.NewStyle().Foreground(MutedColor)
	t.Blurred.UnselectedPrefix = lipgloss.NewStyle().Foreground(DarkGrayColor)

	t.Focused.ErrorIndicator = lipgloss.NewStyle().Foreground(ErrorColor).Bold(true)
	t.Focused.ErrorMessage = lipgloss.NewStyle().Foreground(ErrorColor)
	t.Blurred.ErrorIndicator = lipgloss.NewStyle().Foreground(ErrorColor)

	t.Focused.FocusedButton = lipgloss.NewStyle().
		Foreground(lipgloss.Color("#000000")).
		Background(PrimaryColor).
		Bold(true).
		Padding(0, 2).
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(PrimaryColor)
	t.Focused.BlurredButton = lipgloss.NewStyle().
		Foreground(MutedColor).
		Padding(0, 2).
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(DarkGrayColor)
	t.Blurred.FocusedButton = t.Focused.BlurredButton
	t.Blurred.BlurredButton = t.Focused.BlurredButton

	return t
}
