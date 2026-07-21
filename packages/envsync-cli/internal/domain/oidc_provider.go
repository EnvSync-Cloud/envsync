package domain

type OidcProvider struct {
	ID              string
	OrgID           string
	ProviderType    string
	IssuerURL       string
	Audience        string
	Enabled         bool
	AllowedSubjects []string
	MachineUserID   string
	CreatedAt       string
	UpdatedAt       string
}

type CreateOidcProviderInput struct {
	ProviderType    string
	IssuerURL       string
	Audience        string
	AllowedSubjects []string
}

type UpdateOidcProviderInput struct {
	ID              string
	Audience        string
	Enabled         *bool
	AllowedSubjects []string
}
