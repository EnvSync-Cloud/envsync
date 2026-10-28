package repository

import (
	"context"
	"fmt"
)

type TeamMemberResponse struct {
	ID                string  `json:"id"`
	UserID            string  `json:"user_id"`
	CreatedAt         string  `json:"created_at"`
	FullName          *string `json:"full_name"`
	Email             string  `json:"email"`
	ProfilePictureURL *string `json:"profile_picture_url"`
}

type TeamResponse struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	OrgID       string  `json:"org_id"`
	Description *string `json:"description"`
	Color       string  `json:"color"`
	RoleID      *string `json:"role_id"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

type TeamDetailResponse struct {
	TeamResponse
	Members []TeamMemberResponse `json:"members"`
}

type TeamRepository interface {
	List(ctx context.Context) ([]TeamResponse, error)
	Get(ctx context.Context, id string) (TeamDetailResponse, error)
	Create(ctx context.Context, payload map[string]any) (TeamResponse, error)
	Update(ctx context.Context, id string, payload map[string]any) error
	Delete(ctx context.Context, id string) error
	AddMember(ctx context.Context, teamID, userID string) error
	RemoveMember(ctx context.Context, teamID, userID string) error
	AssignRole(ctx context.Context, teamID, roleID string) error
	UnassignRole(ctx context.Context, teamID string) error
}

type teamRepo struct{}

func NewTeamRepository() TeamRepository {
	return &teamRepo{}
}

func (r *teamRepo) List(ctx context.Context) ([]TeamResponse, error) {
	client := createHTTPClient()
	var result []TeamResponse
	resp, err := client.R().SetContext(ctx).SetResult(&result).Get("/api/team")
	if err != nil {
		return nil, err
	}
	if resp.IsStatusFailure() {
		return nil, fmt.Errorf("list teams failed: %s", resp.String())
	}
	return result, nil
}

func (r *teamRepo) Get(ctx context.Context, id string) (TeamDetailResponse, error) {
	client := createHTTPClient()
	var result TeamDetailResponse
	resp, err := client.R().SetContext(ctx).SetResult(&result).Get(fmt.Sprintf("/api/team/%s", id))
	if err != nil {
		return TeamDetailResponse{}, err
	}
	if resp.IsStatusFailure() {
		return TeamDetailResponse{}, fmt.Errorf("get team failed: %s", resp.String())
	}
	return result, nil
}

func (r *teamRepo) Create(ctx context.Context, payload map[string]any) (TeamResponse, error) {
	client := createHTTPClient()
	var result TeamResponse
	resp, err := client.R().SetContext(ctx).SetBody(payload).SetResult(&result).Post("/api/team")
	if err != nil {
		return TeamResponse{}, err
	}
	if resp.IsStatusFailure() {
		return TeamResponse{}, fmt.Errorf("create team failed: %s", resp.String())
	}
	return result, nil
}

func (r *teamRepo) Update(ctx context.Context, id string, payload map[string]any) error {
	client := createHTTPClient()
	resp, err := client.R().SetContext(ctx).SetBody(payload).Patch(fmt.Sprintf("/api/team/%s", id))
	if err != nil {
		return err
	}
	if resp.IsStatusFailure() {
		return fmt.Errorf("update team failed: %s", resp.String())
	}
	return nil
}

func (r *teamRepo) Delete(ctx context.Context, id string) error {
	client := createHTTPClient()
	resp, err := client.R().SetContext(ctx).Delete(fmt.Sprintf("/api/team/%s", id))
	if err != nil {
		return err
	}
	if resp.IsStatusFailure() {
		return fmt.Errorf("delete team failed: %s", resp.String())
	}
	return nil
}

func (r *teamRepo) AddMember(ctx context.Context, teamID, userID string) error {
	client := createHTTPClient()
	resp, err := client.R().
		SetContext(ctx).
		SetBody(map[string]string{"user_id": userID}).
		Post(fmt.Sprintf("/api/team/%s/members", teamID))
	if err != nil {
		return err
	}
	if resp.IsStatusFailure() {
		return fmt.Errorf("add team member failed: %s", resp.String())
	}
	return nil
}

func (r *teamRepo) RemoveMember(ctx context.Context, teamID, userID string) error {
	client := createHTTPClient()
	resp, err := client.R().SetContext(ctx).Delete(fmt.Sprintf("/api/team/%s/members/%s", teamID, userID))
	if err != nil {
		return err
	}
	if resp.IsStatusFailure() {
		return fmt.Errorf("remove team member failed: %s", resp.String())
	}
	return nil
}

func (r *teamRepo) AssignRole(ctx context.Context, teamID, roleID string) error {
	client := createHTTPClient()
	resp, err := client.R().
		SetContext(ctx).
		SetBody(map[string]string{"role_id": roleID}).
		Post(fmt.Sprintf("/api/team/%s/assign-role", teamID))
	if err != nil {
		return err
	}
	if resp.IsStatusFailure() {
		return fmt.Errorf("assign team role failed: %s", resp.String())
	}
	return nil
}

func (r *teamRepo) UnassignRole(ctx context.Context, teamID string) error {
	client := createHTTPClient()
	resp, err := client.R().SetContext(ctx).Post(fmt.Sprintf("/api/team/%s/unassign-role", teamID))
	if err != nil {
		return err
	}
	if resp.IsStatusFailure() {
		return fmt.Errorf("unassign team role failed: %s", resp.String())
	}
	return nil
}
