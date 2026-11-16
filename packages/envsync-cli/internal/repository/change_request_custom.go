package repository

import (
	"context"
	"fmt"
)

type ChangeRequestItemResponse struct {
	ID              string  `json:"id"`
	ChangeRequestID string  `json:"change_request_id"`
	Key             string  `json:"key"`
	PreviousValue   *string `json:"previous_value"`
	ProposedValue   *string `json:"proposed_value"`
	Operation       string  `json:"operation"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
}

type ChangeRequestResponse struct {
	ID                string                      `json:"id"`
	OrgID             string                      `json:"org_id"`
	AppID             string                      `json:"app_id"`
	RequestKind       string                      `json:"request_kind"`
	SourceEnvTypeID   *string                     `json:"source_env_type_id"`
	TargetEnvTypeID   string                      `json:"target_env_type_id"`
	Status            string                      `json:"status"`
	Title             string                      `json:"title"`
	Message           string                      `json:"message"`
	RequestedByUserID string                      `json:"requested_by_user_id"`
	ReviewedByUserID  *string                     `json:"reviewed_by_user_id"`
	ReviewedAt        *string                     `json:"reviewed_at"`
	AppliedAt         *string                     `json:"applied_at"`
	RejectionReason   *string                     `json:"rejection_reason"`
	CreatedAt         string                      `json:"created_at"`
	UpdatedAt         string                      `json:"updated_at"`
	EnvItemCount      int                         `json:"env_item_count"`
	SecretItemCount   int                         `json:"secret_item_count"`
	EnvItems          []ChangeRequestItemResponse `json:"env_items"`
	SecretItems       []ChangeRequestItemResponse `json:"secret_items"`
}

type ChangeRequestRepository interface {
	CreateDirect(ctx context.Context, payload map[string]any) (ChangeRequestResponse, error)
	CreatePromotion(ctx context.Context, payload map[string]any) (ChangeRequestResponse, error)
	List(ctx context.Context) ([]ChangeRequestResponse, error)
	Get(ctx context.Context, id string) (ChangeRequestResponse, error)
	Approve(ctx context.Context, id string) (ChangeRequestResponse, error)
	Reject(ctx context.Context, id, reason string) (ChangeRequestResponse, error)
	Cancel(ctx context.Context, id string) (ChangeRequestResponse, error)
}

type changeRequestRepo struct{}

func NewChangeRequestRepository() ChangeRequestRepository {
	return &changeRequestRepo{}
}

func (r *changeRequestRepo) CreateDirect(ctx context.Context, payload map[string]any) (ChangeRequestResponse, error) {
	return r.post(ctx, "/api/change_request/direct", payload)
}

func (r *changeRequestRepo) CreatePromotion(ctx context.Context, payload map[string]any) (ChangeRequestResponse, error) {
	return r.post(ctx, "/api/change_request/promotion", payload)
}

func (r *changeRequestRepo) List(ctx context.Context) ([]ChangeRequestResponse, error) {
	client := createHTTPClient()
	var result []ChangeRequestResponse
	resp, err := client.R().SetContext(ctx).SetResult(&result).Get("/api/change_request")
	if err != nil {
		return nil, err
	}
	if resp.IsStatusFailure() {
		return nil, fmt.Errorf("list change requests failed: %s", resp.String())
	}
	return result, nil
}

func (r *changeRequestRepo) Get(ctx context.Context, id string) (ChangeRequestResponse, error) {
	client := createHTTPClient()
	var result ChangeRequestResponse
	resp, err := client.R().SetContext(ctx).SetResult(&result).Get(fmt.Sprintf("/api/change_request/%s", id))
	if err != nil {
		return ChangeRequestResponse{}, err
	}
	if resp.IsStatusFailure() {
		return ChangeRequestResponse{}, fmt.Errorf("get change request failed: %s", resp.String())
	}
	return result, nil
}

func (r *changeRequestRepo) Approve(ctx context.Context, id string) (ChangeRequestResponse, error) {
	return r.post(ctx, fmt.Sprintf("/api/change_request/%s/approve", id), nil)
}

func (r *changeRequestRepo) Reject(ctx context.Context, id, reason string) (ChangeRequestResponse, error) {
	return r.post(ctx, fmt.Sprintf("/api/change_request/%s/reject", id), map[string]string{"rejection_reason": reason})
}

func (r *changeRequestRepo) Cancel(ctx context.Context, id string) (ChangeRequestResponse, error) {
	return r.post(ctx, fmt.Sprintf("/api/change_request/%s/cancel", id), nil)
}

func (r *changeRequestRepo) post(ctx context.Context, path string, payload any) (ChangeRequestResponse, error) {
	client := createHTTPClient()
	var result ChangeRequestResponse
	req := client.R().SetContext(ctx).SetResult(&result)
	if payload != nil {
		req.SetBody(payload)
	}
	resp, err := req.Post(path)
	if err != nil {
		return ChangeRequestResponse{}, err
	}
	if resp.IsStatusFailure() {
		return ChangeRequestResponse{}, fmt.Errorf("change request call failed: %s", resp.String())
	}
	return result, nil
}
