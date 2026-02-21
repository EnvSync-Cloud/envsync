package repository

import (
	"context"
	"fmt"
	"time"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	sdkclient "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/client"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
)

type ApplicationRepository interface {
	Create(app requests.ApplicationRequest) (responses.AppResponse, error)
	GetAll() ([]responses.AppResponse, error)
	Delete(id string) error
	GetByID(id string) (responses.AppResponse, error)
}

type appRepo struct {
	client *sdkclient.Client
}

func NewApplicationRepository() ApplicationRepository {
	client := createSDKClient()

	return &appRepo{
		client: client,
	}
}

func (a *appRepo) Create(app requests.ApplicationRequest) (responses.AppResponse, error) {
	enableSecrets := app.EnableSecrets
	var publicKey *string
	if app.PublicKey != "" {
		publicKey = &app.PublicKey
	}

	resp, err := a.client.Applications.CreateApp(context.Background(), &sdk.CreateAppRequest{
		Name:          app.Name,
		Description:   app.Description,
		EnableSecrets: &enableSecrets,
		PublicKey:     publicKey,
		Metadata:      app.Metadata,
	})
	if err != nil {
		return responses.AppResponse{}, err
	}

	return responses.AppResponse{
		ID:   resp.Id,
		Name: app.Name,
	}, nil
}

func (a *appRepo) GetAll() ([]responses.AppResponse, error) {
	apps, err := a.client.Applications.GetApps(context.Background())
	if err != nil {
		return nil, err
	}

	result := make([]responses.AppResponse, len(apps))
	for i, app := range apps {
		result[i] = sdkAppsItemToResponse(app)
	}

	return result, nil
}

func (a *appRepo) Delete(id string) error {
	_, err := a.client.Applications.DeleteApp(context.Background(), id)
	return err
}

func (a *appRepo) GetByID(id string) (responses.AppResponse, error) {
	app, err := a.client.Applications.GetApp(context.Background(), id)
	if err != nil {
		return responses.AppResponse{}, err
	}

	return sdkAppToResponse(app), nil
}

func sdkAppsItemToResponse(app *sdk.GetAppsResponseItem) responses.AppResponse {
	envTypes := make([]responses.EnvTypeResponse, len(app.EnvTypes))
	for i, et := range app.EnvTypes {
		envTypes[i] = responses.EnvTypeResponse{
			ID:          et.Id,
			Name:        et.Name,
			IsDefault:   et.IsDefault,
			IsProtected: et.IsProtected,
			Color:       et.Color,
		}
	}

	var publicKey string
	if app.PublicKey != nil {
		publicKey = *app.PublicKey
	}

	createdAt, _ := time.Parse(time.RFC3339, app.CreatedAt)
	updatedAt, _ := time.Parse(time.RFC3339, app.UpdatedAt)

	return responses.AppResponse{
		ID:              app.Id,
		Name:            app.Name,
		Description:     app.Description,
		Metadata:        app.Metadata,
		OrgID:           app.OrgId,
		EnvTypes:        envTypes,
		EnvCount:        fmt.Sprintf("%v", app.EnvCount),
		EnableSecrets:   app.EnableSecrets,
		PublicKey:       publicKey,
		IsManagedSecret: app.IsManagedSecret,
		CreatedAt:       createdAt,
		UpdatedAt:       updatedAt,
	}
}

func sdkAppToResponse(app *sdk.GetAppResponse) responses.AppResponse {
	envTypes := make([]responses.EnvTypeResponse, len(app.EnvTypes))
	for i, et := range app.EnvTypes {
		envTypes[i] = responses.EnvTypeResponse{
			ID:          et.Id,
			Name:        et.Name,
			IsDefault:   et.IsDefault,
			IsProtected: et.IsProtected,
			Color:       et.Color,
		}
	}

	var publicKey string
	if app.PublicKey != nil {
		publicKey = *app.PublicKey
	}

	createdAt, _ := time.Parse(time.RFC3339, app.CreatedAt)
	updatedAt, _ := time.Parse(time.RFC3339, app.UpdatedAt)

	return responses.AppResponse{
		ID:              app.Id,
		Name:            app.Name,
		Description:     app.Description,
		Metadata:        app.Metadata,
		OrgID:           app.OrgId,
		EnvTypes:        envTypes,
		EnvCount:        fmt.Sprintf("%v", app.EnvCount),
		EnableSecrets:   app.EnableSecrets,
		PublicKey:       publicKey,
		IsManagedSecret: app.IsManagedSecret,
		CreatedAt:       createdAt,
		UpdatedAt:       updatedAt,
	}
}
