package requests

type InitOrgCARequest struct {
	OrgName     string `json:"org_name"`
	Description string `json:"description,omitempty"`
}

type IssueMemberCertRequest struct {
	MemberEmail string            `json:"member_email"`
	Role        string            `json:"role"`
	Description string            `json:"description,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

type IssueLeafCertRequest struct {
	AppID        string
	EnvTypeID    string
	CommonName   string
	SANs         []string
	TTLDays      int
	KeyAlgorithm string
	Description  string
}

type SignCsrRequest struct {
	AppID       string
	CSRPEM      string
	TTLDays     int
	Description string
}

type RevokeCertRequest struct {
	Reason int `json:"reason"`
}
