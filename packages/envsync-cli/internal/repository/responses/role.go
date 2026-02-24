package responses

type RoleResponse struct {
	ID          string `json:"id"`
	OrgID       string `json:"org_id"`
	Name        string `json:"name"`
	CanEdit     bool   `json:"can_edit"`
	CanView     bool   `json:"can_view"`
	HaveAPI     bool   `json:"have_api_access"`
	HaveBilling bool   `json:"have_billing_options"`
	HaveWebhook bool   `json:"have_webhook_access"`
	HaveGpg     bool   `json:"have_gpg_access"`
	HaveCert    bool   `json:"have_cert_access"`
	HaveAudit   bool   `json:"have_audit_access"`
	Color       string `json:"color"`
	IsAdmin     bool   `json:"is_admin"`
	IsMaster    bool   `json:"is_master"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}
