package domain

type SamlProvider struct {
	ID           string
	OrgID        string
	ProviderType string
	Name         string
	EntityID     string
	SsoURL       string
	Certificate  string
	Enabled      bool
	CreatedAt    string
	UpdatedAt    string
}

type CreateSamlProviderInput struct {
	ProviderType string
	Name         string
	EntityID     string
	SsoURL       string
	Certificate  string
}

type UpdateSamlProviderInput struct {
	ID          string
	Name        string
	EntityID    string
	SsoURL      string
	Certificate string
	Enabled     *bool
}

type SamlSsoResult struct {
	RedirectURL string
	RequestID   string
}
