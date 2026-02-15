package app

import (
	"context"
	"errors"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/presentation/tui/factory"
	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
)

type listAppsUseCase struct {
	appService services.ApplicationService
	tui        *factory.AppFactory
}

func NewListAppsUseCase() ListAppsUseCase {
	tui := factory.NewAppFactory()
	service := services.NewAppService()
	return &listAppsUseCase{
		appService: service,
		tui:        tui,
	}
}

func (uc *listAppsUseCase) Execute(ctx context.Context) ([]domain.Application, error) {
	// Get applications from service
	apps, err := uc.findAllApplications()
	if err != nil {
		return nil, err
	}

	json, _ := ctx.Value("json").(bool)

	if !json {
		if err := uc.tui.ListAppsInteractive(apps); err != nil {
			if !errors.Is(err, tea.ErrProgramKilled) {
				return nil, NewTUIError("failed to list applications", err)
			}
		}
	}

	return apps, nil
}

func (uc *listAppsUseCase) findAllApplications() ([]domain.Application, error) {
	// Retrieve all applications from the service
	apps, err := uc.appService.GetAllApps()
	if err != nil {
		return nil, NewServiceError("failed to retrieve applications", err)
	}
	return apps, nil
}
