package mappers

import (
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/helper"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
)

func ServiceTokenResponseToDomain(res responses.ServiceTokenResponse) domain.ServiceToken {
	permissions := domain.ServiceTokenPermissions{
		Read:  res.Permissions.Read,
		Write: res.Permissions.Write,
	}

	// An empty rotated_from_id means "not rotated": keep the pointer nil so
	// consumers can tell that apart from a rotation that named "".
	var rotatedFromID *string
	if res.RotatedFromId != "" {
		rotatedFromID = &res.RotatedFromId
	}

	return domain.ServiceToken{
		ID:            res.Id,
		Name:          res.Name,
		AppID:         res.AppId,
		EnvTypeID:     res.EnvTypeId,
		Permissions:   &permissions,
		Scopes:        mapResScopeToDomain(res.Scopes),
		Token:         res.Token,
		ExpiresAt:     res.ExpiresAt,
		LastUsedAt:    res.LastUsedAt,
		CreatedAt:     res.CreatedAt,
		RotatedFromID: rotatedFromID,
		GraceUntil:    res.GraceUntil,
	}
}

// DomainToServiceTokenRequest keeps unset fields unset: the API distinguishes
// "absent" (server default applies) from an explicit empty value, so only the
// fields the user actually stated are sent.
func DomainToServiceTokenRequest(d *domain.ServiceToken) requests.CreateServiceTokenRequest {
	req := requests.CreateServiceTokenRequest{
		Name:   d.Name,
		Scopes: mapDomainToServiceTokenScopeRequest(d.Scopes),
	}

	if d.AppID != "" {
		req.AppId = &d.AppID
	}
	if d.EnvTypeID != "" {
		req.EnvTypeId = &d.EnvTypeID
	}
	if d.Permissions != nil {
		req.Permissions = &requests.ServiceTokenPermissionRequest{
			Read:  d.Permissions.Read,
			Write: d.Permissions.Write,
		}
	}
	if d.ExpiresInDays > 0 {
		req.ExpiresInDays = &d.ExpiresInDays
	}

	return req
}

func mapDomainToServiceTokenScopeRequest(d []domain.ServiceTokenScopes) []*requests.ServiceTokenScopeRequest {
	return helper.Map(d, func(s domain.ServiceTokenScopes) *requests.ServiceTokenScopeRequest {
		scope := &requests.ServiceTokenScopeRequest{Path: s.Path}
		if s.EnvTypeID != "" {
			scope.EnvTypeId = &s.EnvTypeID
		}
		return scope
	})
}

func mapResScopeToDomain(res []responses.ServiceTokenScope) []domain.ServiceTokenScopes {
	return helper.Map(res, func(s responses.ServiceTokenScope) domain.ServiceTokenScopes {
		return domain.ServiceTokenScopes{
			EnvTypeID: s.EnvTypeId,
			Path:      s.Path,
		}
	})
}
