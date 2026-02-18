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

type RevokeCertRequest struct {
	Reason int `json:"reason"`
}
