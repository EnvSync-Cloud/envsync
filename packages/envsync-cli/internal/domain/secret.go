package domain

type Secret struct {
	ID        string
	Key       string
	Value     string
	AppID     string
	EnvTypeID string
	OrgID     string
	CreatedAt string
	UpdatedAt string
}
