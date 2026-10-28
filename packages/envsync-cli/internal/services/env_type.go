package services

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/mappers"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type EnvTypeService interface {
	CreateEnvType(ctx context.Context, envType *domain.EnvType) (domain.EnvType, error)
	GetEnvTypeByID(ctx context.Context, id string) (domain.EnvType, error)
	GetEnvTypesByAppID(ctx context.Context, appID string) ([]domain.EnvType, error)
	DeleteEnvType(ctx context.Context, id string) error
}

type envTypeService struct {
	repo repository.EnvTypeRepository
}

func NewEnvTypeService() EnvTypeService {
	r := repository.NewEnvTypeRepository()

	return &envTypeService{
		repo: r,
	}
}

func (e *envTypeService) CreateEnvType(ctx context.Context, envType *domain.EnvType) (result domain.EnvType, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.env_type.create_env_type")
	defer end(&err)

	req := mappers.EnvTypeDomainToRequest(envType)

	res, err := e.repo.Create(ctx, &req)
	if err != nil {
		return domain.EnvType{}, err
	}

	return mappers.EnvTypeResponseToDomain(res), nil
}

func (e *envTypeService) GetEnvTypeByID(ctx context.Context, id string) (result domain.EnvType, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.env_type.get_env_type_by_id")
	defer end(&err)

	res, err := e.repo.GetByID(ctx, id)
	if err != nil {
		return domain.EnvType{}, err
	}

	return mappers.EnvTypeResponseToDomain(res), nil
}

func (e *envTypeService) GetEnvTypesByAppID(ctx context.Context, appID string) (result []domain.EnvType, err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.env_type.get_env_types_by_app_id")
	defer end(&err)

	res, err := e.repo.GetByAppID(ctx, appID)
	if err != nil {
		return nil, err
	}

	var envTypes []domain.EnvType
	for _, envTypeResp := range res {
		envTypes = append(envTypes, mappers.EnvTypeResponseToDomain(envTypeResp))
	}

	return envTypes, nil
}

func (e *envTypeService) DeleteEnvType(ctx context.Context, id string) (err error) {
	ctx, end := telemetry.StartSpan(ctx, "svc.env_type.delete_env_type")
	defer end(&err)

	if err := e.repo.Delete(ctx, id); err != nil {
		return err
	}
	return nil
}
