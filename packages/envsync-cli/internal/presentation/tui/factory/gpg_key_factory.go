package factory

import (
	"errors"
	"fmt"
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

// gpgKeyTableRows projects GPG keys onto those columns. Cell values come from
// the formatter so the interactive and plain tables always agree.
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

	// No alt screen: the table renders inline rather than taking over the
	// terminal.
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
//
// The fields mirror the `gpg generate` flags; values already set (from flags)
// are offered as starting points and can be edited in the form.
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
