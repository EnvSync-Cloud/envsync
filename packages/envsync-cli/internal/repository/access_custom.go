package repository

import (
	"context"
	"fmt"
)

type AppGrantResponse struct {
	SubjectID   string `json:"subject_id"`
	SubjectType string `json:"subject_type"`
	Relation    string `json:"relation"`
}

type EffectiveAccessResponse struct {
	UserID   string   `json:"user_id"`
	Email    string   `json:"email"`
	Relation *string  `json:"relation"`
	Source   *string  `json:"source"`
	Teams    []string `json:"teams"`
}

type AccessRepository interface {
	GrantAppAccess(ctx context.Context, appID, subjectID, subjectType, relation string) error
	RevokeAppAccess(ctx context.Context, appID, subjectID, subjectType, relation string) error
	ListAppGrants(ctx context.Context, appID string) ([]AppGrantResponse, error)
	EffectiveAppAccess(ctx context.Context, appID string) ([]EffectiveAccessResponse, error)
}

type accessRepo struct{}

func NewAccessRepository() AccessRepository {
	return &accessRepo{}
}

func (r *accessRepo) GrantAppAccess(ctx context.Context, appID, subjectID, subjectType, relation string) error {
	client := createHTTPClient()
	resp, err := client.R().
		SetContext(ctx).
		SetBody(map[string]string{
			"subject_id":   subjectID,
			"subject_type": subjectType,
			"relation":     relation,
		}).
		Post(fmt.Sprintf("/api/permission/app/%s/grant", appID))
	if err != nil {
		return err
	}
	if resp.IsStatusFailure() {
		return fmt.Errorf("grant app access failed: %s", resp.String())
	}
	return nil
}

func (r *accessRepo) RevokeAppAccess(ctx context.Context, appID, subjectID, subjectType, relation string) error {
	client := createHTTPClient()
	resp, err := client.R().
		SetContext(ctx).
		SetBody(map[string]string{
			"subject_id":   subjectID,
			"subject_type": subjectType,
			"relation":     relation,
		}).
		Post(fmt.Sprintf("/api/permission/app/%s/revoke", appID))
	if err != nil {
		return err
	}
	if resp.IsStatusFailure() {
		return fmt.Errorf("revoke app access failed: %s", resp.String())
	}
	return nil
}

func (r *accessRepo) ListAppGrants(ctx context.Context, appID string) ([]AppGrantResponse, error) {
	client := createHTTPClient()
	var result []AppGrantResponse
	resp, err := client.R().SetContext(ctx).SetResult(&result).Get(fmt.Sprintf("/api/permission/app/%s/grants", appID))
	if err != nil {
		return nil, err
	}
	if resp.IsStatusFailure() {
		return nil, fmt.Errorf("list app grants failed: %s", resp.String())
	}
	return result, nil
}

func (r *accessRepo) EffectiveAppAccess(ctx context.Context, appID string) ([]EffectiveAccessResponse, error) {
	client := createHTTPClient()
	var result []EffectiveAccessResponse
	resp, err := client.R().SetContext(ctx).SetResult(&result).Get(fmt.Sprintf("/api/permission/app/%s/effective-access", appID))
	if err != nil {
		return nil, err
	}
	if resp.IsStatusFailure() {
		return nil, fmt.Errorf("list effective app access failed: %s", resp.String())
	}
	return result, nil
}
