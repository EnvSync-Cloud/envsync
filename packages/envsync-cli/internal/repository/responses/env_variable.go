package responses

type EnvironmentVariable struct {
	ID        string `json:"id"`
	Key       string `json:"key"`
	Value     string `json:"value"`
	AppID     string `json:"app_id"`
	EnvTypeID string `json:"env_type_id"`
	OrgID     string `json:"org_id"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}
