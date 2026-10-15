package repository

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"
	sdkclient "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/client"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/helper"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
)

type ServiceTokenRepository interface {
	Create(ctx context.Context, req requests.CreateServiceTokenRequest) (responses.ServiceTokenResponse, error)
	GetAll(ctx context.Context) ([]responses.ServiceTokenResponse, error)
	GetByID(ctx context.Context, id string) (responses.ServiceTokenResponse, error)
	Delete(ctx context.Context, id string) error
}

type serviceTokenRepo struct {
	client *sdkclient.Client
}

func NewServiceTokenRepository() ServiceTokenRepository {
	client := createSDKClient()
	return &serviceTokenRepo{
		client: client,
	}
}

func (r *serviceTokenRepo) Create(ctx context.Context, req requests.CreateServiceTokenRequest) (responses.ServiceTokenResponse, error) {
	sdkReq := &sdk.CreateServiceTokenRequest{
		Name:          req.Name,
		AppId:         req.AppId,
		EnvTypeId:     req.EnvTypeId,
		ExpiresInDays: req.ExpiresInDays,
	}
	if req.Permissions != nil {
		sdkReq.Permissions = &sdk.ServiceTokenPermissions{
			Read:  req.Permissions.Read,
			Write: req.Permissions.Write,
		}
	}
	if len(req.Scopes) > 0 {
		sdkReq.Scopes = make([]*sdk.ServiceTokenScope, len(req.Scopes))
		for i, s := range req.Scopes {
			sdkReq.Scopes[i] = &sdk.ServiceTokenScope{
				EnvTypeId: s.EnvTypeId,
				Path:      s.Path,
			}
		}
	}

	res, err := r.client.ServiceTokens.CreateServiceToken(ctx, sdkReq)
	if err != nil {
		return responses.ServiceTokenResponse{}, err
	}

	return sdkCreateTokenToResponse(res), nil
}

func (r *serviceTokenRepo) GetAll(ctx context.Context) ([]responses.ServiceTokenResponse, error) {
	res, err := r.client.ServiceTokens.GetAllServiceTokens(ctx, &sdk.GetAllServiceTokensRequest{})
	if err != nil {
		return nil, err
	}

	result := make([]responses.ServiceTokenResponse, len(res))
	for i, tok := range res {
		result[i] = sdkServiceTokenToResponse(tok)
	}

	return result, nil
}

func (r *serviceTokenRepo) GetByID(ctx context.Context, id string) (responses.ServiceTokenResponse, error) {
	res, err := r.client.ServiceTokens.GetServiceToken(ctx, id)
	if err != nil {
		return responses.ServiceTokenResponse{}, err
	}

	return sdkServiceTokenToResponse(res), nil
}

func (r *serviceTokenRepo) Delete(ctx context.Context, id string) error {
	_, err := r.client.ServiceTokens.DeleteServiceToken(ctx, id)
	return err
}

// sdkCreateTokenToResponse maps the create response. Its nullable fields
// (app_id, env_type_id, rotated_from_id, scope env_type_id) are dereferenced
// defensively: the API allows them to be null on unscoped tokens.
func sdkCreateTokenToResponse(res *sdk.CreateServiceTokenResponse) responses.ServiceTokenResponse {
	return responses.ServiceTokenResponse{
		Id:            res.Id,
		Name:          res.Name,
		AppId:         derefString(res.AppId),
		EnvTypeId:     derefString(res.EnvTypeId),
		Permissions:   sdkPermissionsToResponse(res.Permissions),
		Scopes:        sdkScopesToResponse(res.Scopes),
		Token:         res.Token,
		RotatedFromId: derefString(res.RotatedFromId),
		ExpiresAt:     helper.ParseStrToTime(res.ExpiresAt),
		CreatedAt:     helper.ParseStrToTime(res.CreatedAt),
	}
}

// sdkServiceTokenToResponse maps the list/get response.
func sdkServiceTokenToResponse(res *sdk.ServiceTokenResponse) responses.ServiceTokenResponse {
	return responses.ServiceTokenResponse{
		Id:            res.Id,
		Name:          res.Name,
		AppId:         derefString(res.AppId),
		EnvTypeId:     derefString(res.EnvTypeId),
		Permissions:   sdkPermissionsToResponse(res.Permissions),
		Scopes:        sdkScopesToResponse(res.Scopes),
		RotatedFromId: derefString(res.RotatedFromId),
		GraceUntil:    helper.ParseStringPtrToTime(res.GraceUntil),
		ExpiresAt:     helper.ParseStrToTime(res.ExpiresAt),
		LastUsedAt:    helper.ParseStringPtrToTime(res.LastUsedAt),
		CreatedAt:     helper.ParseStrToTime(res.CreatedAt),
	}
}

func sdkPermissionsToResponse(p *sdk.ServiceTokenPermissions) responses.ServiceTokenPermission {
	if p == nil {
		return responses.ServiceTokenPermission{}
	}
	return responses.ServiceTokenPermission{Read: p.Read, Write: p.Write}
}

func sdkScopesToResponse(scopes []*sdk.ServiceTokenScope) []responses.ServiceTokenScope {
	return helper.Map(scopes, func(s *sdk.ServiceTokenScope) responses.ServiceTokenScope {
		return responses.ServiceTokenScope{
			EnvTypeId: derefString(s.EnvTypeId),
			Path:      s.Path,
		}
	})
}
