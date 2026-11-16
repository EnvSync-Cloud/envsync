package factory

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/huh"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/component"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/styles"
)

type GpgKeyFactory struct{}

func NewGpgKeyFactory() *GpgKeyFactory {
	return &GpgKeyFactory{}
}

// gpgKeyTableColumns are the columns shared by every GPG key table.
func gpgKeyTableColumns() []table.Column {
	return []table.Column{
		{Title: "ID", Width: 36},
		{Title: "NAME", Width: 20},
		{Title: "EMAIL", Width: 30},
		{Title: "FINGERPRINT", Width: 16},
		{Title: "ALGORITHM", Width: 10},
		{Title: "STATUS", Width: 8},
	}
}

// gpgKeyTableRows projects GPG keys onto those columns
func gpgKeyTableRows(keys []domain.GpgKey) []table.Row {
	rows := make([]table.Row, 0, len(keys))
	for _, k := range keys {
		rows = append(rows, table.Row{
			k.ID, k.Name, k.Email,
			formatters.ShortFingerprint(k.Fingerprint),
			k.Algorithm,
			formatters.GpgKeyStatus(k),
		})
	}
	return rows
}

// ListKeysInteractive runs the interactive GPG key listing flow
func (f *GpgKeyFactory) ListKeysInteractive(keys []domain.GpgKey) error {
	model := component.NewTableModel(component.TableConfig{
		Title:   "GPG Keys",
		Columns: gpgKeyTableColumns(),
		Rows:    gpgKeyTableRows(keys),
		Width:   140,
		Height:  24,
	})

	if _, err := tea.NewProgram(model).Run(); err != nil {
		return fmt.Errorf("error running gpg key list TUI: %w", err)
	}

	return nil
}

// GenerateKeyValues are the values the generation form collects.
type GenerateKeyValues struct {
	Name          string
	Email         string
	Algorithm     string
	ExpiresInDays *int
}

// GenerateKeyTUI runs the interactive key generation flow.
func (f *GpgKeyFactory) GenerateKeyTUI(preset GenerateKeyValues) (GenerateKeyValues, error) {
	name := preset.Name
	email := preset.Email

	// Flag values arrive as API slugs ("ecc-p256"); the select works in labels.
	algorithm := domain.GpgAlgorithmOptions()[0].Label
	if opt, ok := domain.ResolveGpgAlgorithm(preset.Algorithm); ok {
		algorithm = opt.Label
	}
	expiresText := ""
	if preset.ExpiresInDays != nil {
		expiresText = strconv.Itoa(*preset.ExpiresInDays)
	}

	labels := make([]huh.Option[string], 0, 4)
	for _, o := range domain.GpgAlgorithmOptions() {
		labels = append(labels, huh.NewOption(o.Label, o.Label))
	}

	details := huh.NewGroup(
		huh.NewInput().
			Title("Name").
			Description("Key owner name.").
			Placeholder("release-bot").
			Value(&name).
			Validate(func(s string) error {
				if strings.TrimSpace(s) == "" {
					return fmt.Errorf("name is required")
				}
				if len(s) > 100 {
					return fmt.Errorf("name must be 100 characters or less")
				}
				return nil
			}),

		huh.NewInput().
			Title("Email").
			Description("Key owner email.").
			Placeholder("bot@example.com").
			Value(&email).
			Validate(func(s string) error {
				s = strings.TrimSpace(s)
				if s == "" {
					return fmt.Errorf("email is required")
				}
				if !strings.Contains(s, "@") || strings.ContainsAny(s, " \t") {
					return fmt.Errorf("must be a valid email address")
				}
				return nil
			}),
	).Title("Key owner")

	options := huh.NewGroup(
		huh.NewSelect[string]().
			Title("Algorithm").
			Description("RSA is fixed at 4096 bits; the ECC curves take no key size.").
			Options(labels...).
			Value(&algorithm),

		huh.NewInput().
			Title("Expires in (days)").
			Description("Leave empty for a key that never expires.").
			Placeholder("365").
			Value(&expiresText).
			Validate(func(s string) error {
				s = strings.TrimSpace(s)
				if s == "" {
					return nil
				}
				days, err := strconv.Atoi(s)
				if err != nil || days <= 0 {
					return fmt.Errorf("must be a positive number of days")
				}
				return nil
			}),
	).Title("Key options")

	form := huh.NewForm(details, options).
		WithTheme(styles.FormTheme()).
		WithShowHelp(false)

	if _, err := tea.NewProgram(formModel{
		form:  form,
		title: "Generate GPG key",
		width: 80,
	}).Run(); err != nil {
		return GenerateKeyValues{}, err
	}

	if form.State == huh.StateAborted {
		return GenerateKeyValues{}, errors.New("key generation cancelled by user")
	}

	var expiresInDays *int
	if s := strings.TrimSpace(expiresText); s != "" {
		days, _ := strconv.Atoi(s)
		expiresInDays = &days
	}

	return GenerateKeyValues{Name: name, Email: email, Algorithm: algorithm, ExpiresInDays: expiresInDays}, nil
}

// SignKeyValues are the signing details the form collects.
type SignKeyValues struct {
	FilePath string
	Mode     string
	Detached bool
	Output   string
}

// PickGpgKey shows the available keys in a table and returns the one the user
// submits. ok is false when they quit without choosing.
func (f *GpgKeyFactory) PickGpgKey(keys []domain.GpgKey, title string) (domain.GpgKey, bool, error) {
	rows := make([]table.Row, 0, len(keys))
	for _, k := range keys {
		rows = append(rows, table.Row{
			k.Name, k.Email, formatters.ShortFingerprint(k.Fingerprint), k.Algorithm, k.ID,
		})
	}

	// Full screen so the picker cannot stack with the form that follows and
	// drift below its help text on short terminals.
	row, ok, err := selectRow(component.TableConfig{
		Title: title,
		Columns: []table.Column{
			{Title: "NAME", Width: 24},
			{Title: "EMAIL", Width: 28},
			{Title: "FINGERPRINT", Width: 18},
			{Title: "ALGORITHM", Width: 14},
			{Title: "ID", Width: 36},
		},
		Rows:   rows,
		Width:  130,
		Height: 24,
		Help:   "↑/k up • ↓/j down • enter select • q cancel",
	})
	if !ok || err != nil {
		return domain.GpgKey{}, ok, err
	}

	// Match on the ID cell rather than the cursor position so a reordered or
	// filtered table can never select the wrong key.
	for _, k := range keys {
		if k.ID == row[4] {
			return k, true, nil
		}
	}

	return domain.GpgKey{}, false, fmt.Errorf("selected GPG key %q is no longer available", row[4])
}

// boundedFilePicker keeps the file picker inside the form's viewport. The
// group's zoom hands the field the full group height, but the field's box
// renders taller than that (two border lines plus the list's trailing pad),
// so the box is clipped at the bottom and its height drifts past the help
// text. This caps the list and pays for the box chrome up front.
type boundedFilePicker struct {
	*huh.FilePicker
	max int
}

func (b *boundedFilePicker) WithHeight(height int) huh.Field {
	height -= 3 // top and bottom border + the list's trailing pad
	if height > b.max {
		height = b.max
	}
	if height < 4 {
		height = 4
	}
	b.FilePicker.WithHeight(height)
	return b
}

// Update keeps the wrapper in the group's field list: huh stores whatever
// Update returns, so the bound must survive every round trip.
func (b *boundedFilePicker) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	m, cmd := b.FilePicker.Update(msg)
	if fp, ok := m.(*huh.FilePicker); ok {
		b.FilePicker = fp
	}
	return b, cmd
}

// SignKeyTUI runs the interactive signing flow for the remaining details.
func (f *GpgKeyFactory) SignKeyTUI(preset SignKeyValues) (SignKeyValues, error) {
	filePath := preset.FilePath
	mode := preset.Mode
	if mode == "" {
		mode = domain.SignModes()[0]
	}
	detached := preset.Detached
	output := preset.Output

	labels := make([]huh.Option[string], 0, len(domain.SignModes()))
	for _, m := range domain.SignModes() {
		labels = append(labels, huh.NewOption(m, m))
	}

	homeDir := "."
	if d, err := os.UserHomeDir(); err == nil {
		homeDir = d
	}

	picker := huh.NewFilePicker().
		Title("File").
		Description("Select the file to sign.").
		ShowSize(true).
		FileAllowed(true).
		DirAllowed(false).
		Value(&filePath).
		ShowHidden(true).
		CurrentDirectory(homeDir).
		Validate(func(s string) error {
			if strings.TrimSpace(s) == "" {
				return fmt.Errorf("a file is required")
			}
			return nil
		})

	details := huh.NewGroup(
		&boundedFilePicker{FilePicker: picker, max: 12},

		huh.NewSelect[string]().
			Title("Mode").
			Description("How the data should be signed.").
			Options(labels...).
			Value(&mode),
	).Title("Signing details")

	options := huh.NewGroup(
		huh.NewConfirm().
			Title("Detached signature?").
			Description("Write the signature separately instead of embedding it in the data.").
			Affirmative("Yes").
			Negative("No").
			Value(&detached),

		huh.NewInput().
			Title("Output path").
			Description("Leave empty to print the signature to stdout.").
			Placeholder("signature.sig").
			Value(&output),
	).Title("Output")

	form := huh.NewForm(details, options).
		WithTheme(styles.FormTheme()).
		WithShowHelp(false)

	if _, err := tea.NewProgram(formModel{
		form:  form.WithHeight(20),
		title: "Sign with GPG key",
		width: 80,
	}).Run(); err != nil {
		return SignKeyValues{}, err
	}

	if form.State == huh.StateAborted {
		return SignKeyValues{}, errors.New("signing cancelled by user")
	}

	return SignKeyValues{FilePath: filePath, Mode: mode, Detached: detached, Output: output}, nil
}
