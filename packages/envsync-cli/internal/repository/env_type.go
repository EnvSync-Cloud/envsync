package repository

import (
	"context"
	"time"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	sdkclient "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/client"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
)

type EnvTypeRepository interface {
	Create(*requests.EnvTypeRequest) (responses.EnvTypeResponse, error)
	GetAll() ([]responses.EnvTypeResponse, error)
	GetByID(id string) (responses.EnvTypeResponse, error)
	GetByAppID(appID string) ([]responses.EnvTypeResponse, error)
	Delete(string) error
}

type envTypeRepo struct {
	client *sdkclient.Client
}

func NewEnvTypeRepository() EnvTypeRepository {
	client := createSDKClient()

	return &envTypeRepo{
		client: client,
	}
}

func (e *envTypeRepo) Create(req *requests.EnvTypeRequest) (responses.EnvTypeResponse, error) {
	isDefault := req.IsDefault
	isProtected := req.IsProtected
	var color *string
	if req.Color != "" {
		color = &req.Color
	}

	resp, err := e.client.EnvironmentTypes.CreateEnvType(context.Background(), &sdk.CreateEnvTypeRequest{
		Name:        req.Name,
		Color:       color,
		IsDefault:   &isDefault,
		IsProtected: &isProtected,
		AppId:       req.AppID,
	})
	if err != nil {
		return responses.EnvTypeResponse{}, err
	}

	return sdkEnvTypeToResponse(resp), nil
}

func (e *envTypeRepo) GetAll() ([]responses.EnvTypeResponse, error) {
	envTypes, err := e.client.EnvironmentTypes.GetEnvTypes(context.Background())
	if err != nil {
		return nil, err
	}

	result := make([]responses.EnvTypeResponse, len(envTypes))
	for i, et := range envTypes {
		result[i] = sdkEnvTypeToResponse(et)
	}

	return result, nil
}

func (e *envTypeRepo) GetByID(id string) (responses.EnvTypeResponse, error) {
	resp, err := e.client.EnvironmentTypes.GetEnvType(context.Background(), id)
	if err != nil {
		return responses.EnvTypeResponse{}, err
	}

	return sdkEnvTypeToResponse(resp), nil
}

func (e *envTypeRepo) GetByAppID(appID string) ([]responses.EnvTypeResponse, error) {
	envTypes, err := e.client.EnvironmentTypes.GetEnvTypes(context.Background())
	if err != nil {
		return nil, err
	}

	var filtered []responses.EnvTypeResponse
	for _, et := range envTypes {
		if et.AppId == appID {
			filtered = append(filtered, sdkEnvTypeToResponse(et))
		}
	}

	return filtered, nil
}

func (e *envTypeRepo) Delete(id string) error {
	_, err := e.client.EnvironmentTypes.DeleteEnvType(context.Background(), id)
	return err
}

func sdkEnvTypeToResponse(et *sdk.EnvTypeResponse) responses.EnvTypeResponse {
	createdAt, _ := time.Parse(time.RFC3339, et.CreatedAt)
	updatedAt, _ := time.Parse(time.RFC3339, et.UpdatedAt)

	return responses.EnvTypeResponse{
		ID:          et.Id,
		OrgID:       et.OrgId,
		Name:        et.Name,
		AppID:       et.AppId,
		IsDefault:   et.IsDefault,
		IsProtected: et.IsProtected,
		Color:       et.Color,
		CreatedAt:   createdAt,
		UpdatedAt:   updatedAt,
	}
}
