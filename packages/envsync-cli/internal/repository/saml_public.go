package repository

import (
	"context"
	"fmt"
	"net/url"
)

type PublicSamlSsoResponse struct {
	RedirectURL string `json:"redirect_url"`
	RequestID   string `json:"request_id"`
}

func GetPublicSamlMetadata(ctx context.Context, orgID string) (string, error) {
	client := createHTTPClient()
	resp, err := client.R().
		SetContext(ctx).
		Get("/api/saml/metadata/" + url.PathEscape(orgID))
	if err != nil {
		return "", err
	}
	if resp.IsError() {
		return "", fmt.Errorf("public SAML metadata failed: %s", resp.String())
	}
	return resp.String(), nil
}

func StartPublicSamlSso(ctx context.Context, orgSlug string, providerID string) (*PublicSamlSsoResponse, error) {
	client := createHTTPClient()
	body := map[string]string{}
	if providerID != "" {
		body["provider_id"] = providerID
	}

	var out PublicSamlSsoResponse
	resp, err := client.R().
		SetContext(ctx).
		SetBody(body).
		SetResult(&out).
		Post("/api/saml/sso/" + url.PathEscape(orgSlug))
	if err != nil {
		return nil, err
	}
	if resp.IsError() {
		return nil, fmt.Errorf("public SAML SSO start failed: %s", resp.String())
	}
	return &out, nil
}
