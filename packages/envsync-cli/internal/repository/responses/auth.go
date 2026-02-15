package responses

type DeviceCodeResponse struct {
	DeviceCode      string `json:"device_code"`
	UserCode        string `json:"user_code"`
	VerificationUri string `json:"verification_uri_complete"`
	ExpiresIn       int    `json:"expires_in"`
	Interval        int    `json:"interval"`
	ClientId        string `json:"client_id"`
	AuthDomain      string `json:"domain"`
}

type LoginTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	IdToken      string `json:"id_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
}

type UserInfoResponse struct {
	User struct {
		Id                string `json:"id"`
		Email             string `json:"email"`
		OrgId             string `json:"org_id"`
		RoleId            string `json:"role_id"`
		Auth0Id           string `json:"auth0_id"`
		FullName          string `json:"full_name"`
		ProfilePictureUrl string `json:"profile_picture_url"`
		IsActive          bool   `json:"is_active"`
		LastLogin         string `json:"last_login"`
		CreatedAt         string `json:"created_at"`
		UpdatedAt         string `json:"updated_at"`
	} `json:"user"`
	Org struct {
		Id        string                 `json:"id"`
		Name      string                 `json:"name"`
		LogoUrl   string                 `json:"logo_url"`
		Slug      string                 `json:"slug"`
		Size      string                 `json:"size"`
		Website   string                 `json:"website"`
		Metadata  map[string]interface{} `json:"metadata"`
		CreatedAt string                 `json:"created_at"`
		UpdatedAt string                 `json:"updated_at"`
	} `json:"org"`
	Role struct {
		Id                   string `json:"id"`
		OrgId                string `json:"org_id"`
		Name                 string `json:"name"`
		CreatedAt            string `json:"created_at"`
		UpdatedAt            string `json:"updated_at"`
		IsAdmin              bool   `json:"is_admin"`
		CanView              bool   `json:"can_view"`
		CanEdit              bool   `json:"can_edit"`
		HavingBillingOptions bool   `json:"have_billing_options"`
		HavingApiAccess      bool   `json:"have_api_access"`
		HavingWebhookAccess  bool   `json:"have_webhook_access"`
		IsMaster             bool   `json:"is_master"`
	} `json:"role"`
}
