package responses

type UserResponse struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	OrgID     string `json:"org_id"`
	RoleID    string `json:"role_id"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}
