package factory

import (
	"fmt"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/charmbracelet/huh"
)

type InitFactory struct{}

func NewInitFactory() *InitFactory {
	return &InitFactory{}
}

func (f *InitFactory) OpenInitForm(apps []domain.Application) (string, string, error) {
	var appID string
	var envID string

	form := huh.NewForm(huh.NewGroup(
		huh.NewSelect[string]().
			Title("Application Name").
			Description("Choose your application").
			Height(len(apps)+2).
			OptionsFunc(func() []huh.Option[string] {
				if len(apps) == 0 {
					return []huh.Option[string]{
						huh.NewOption("No applications available", ""),
					}
				}
				var options []huh.Option[string]
				for _, a := range apps {
					options = append(options, huh.NewOption(a.Name, a.ID))
				}

				return options
			}, &apps).
			Value(&appID),

		huh.NewSelect[string]().
			Title("Environment").
			Description("Select the environment type").
			OptionsFunc(func() []huh.Option[string] {
				envTypes := []domain.EnvType{}

				for _, a := range apps {
					if a.ID == appID {
						envTypes = a.EnvTypes
						break
					}
				}

				if len(envTypes) == 0 {
					return []huh.Option[string]{
						huh.NewOption("No environments available", ""),
					}
				}
				var options []huh.Option[string]
				for _, envType := range envTypes {
					options = append(options, huh.NewOption(envType.Name, envType.ID))
				}

				return options
			}, &appID).
			Value(&envID),
	))

	if err := form.Run(); err != nil {
		return "", "", fmt.Errorf("failed to run form: %w", err)
	}

	return appID, envID, nil
}
