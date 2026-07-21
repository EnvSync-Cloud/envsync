import z from "zod";
import "zod-openapi/extend";

const samlProviderTypeEnum = z.enum([
	"okta",
	"onelogin",
	"azure-ad",
	"google-workspace",
	"duo",
	"rippling",
	"oracle",
	"ping-identity",
]);

export const createSamlProviderRequestSchema = z
	.object({
		provider_type: samlProviderTypeEnum.openapi({
			example: "okta",
			description: "SAML identity provider type",
		}),
		name: z.string().min(1).max(255).openapi({
			example: "Okta Production",
			description: "Human-readable name for this provider",
		}),
		entity_id: z.string().url().openapi({
			example: "http://www.okta.com/exk123456789",
			description: "SAML entity ID (issuer) from the IdP metadata",
		}),
		sso_url: z.string().url().openapi({
			example: "https://example.okta.com/app/abc123/sso/saml",
			description: "IdP SSO login URL",
		}),
		certificate: z.string().min(1).openapi({
			example: "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----",
			description: "IdP X.509 certificate (PEM format) for signature validation",
		}),
	})
	.openapi({ ref: "CreateSamlProviderRequest" });

export const updateSamlProviderRequestSchema = z
	.object({
		name: z.string().min(1).max(255).optional().openapi({ example: "Okta Production" }),
		entity_id: z.string().url().optional().openapi({ example: "http://www.okta.com/exk123456789" }),
		sso_url: z.string().url().optional().openapi({ example: "https://example.okta.com/app/abc123/sso/saml" }),
		certificate: z.string().min(1).optional().openapi({ example: "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----" }),
		enabled: z.boolean().optional().openapi({ example: true }),
	})
	.openapi({ ref: "UpdateSamlProviderRequest" });

export const samlProviderResponseSchema = z
	.object({
		id: z.string().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
		org_id: z.string().openapi({ example: "org_abc123" }),
		provider_type: samlProviderTypeEnum.openapi({ example: "okta" }),
		name: z.string().openapi({ example: "Okta Production" }),
		entity_id: z.string().openapi({ example: "http://www.okta.com/exk123456789" }),
		sso_url: z.string().openapi({ example: "https://example.okta.com/app/abc123/sso/saml" }),
		certificate: z.string().openapi({ example: "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----" }),
		enabled: z.boolean().openapi({ example: true }),
		created_at: z.string().openapi({ example: "2025-01-01T00:00:00Z" }),
		updated_at: z.string().openapi({ example: "2025-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "SamlProviderResponse" });

export const samlProvidersResponseSchema = z
	.array(samlProviderResponseSchema)
	.openapi({ ref: "SamlProvidersResponse" });

export const samlSsoRequestSchema = z
	.object({
		provider_id: z.string().uuid().openapi({
			example: "550e8400-e29b-41d4-a716-446655440000",
			description: "SAML provider ID to initiate SSO with",
		}),
	})
	.openapi({ ref: "SamlSsoRequest" });

export const samlSsoResponseSchema = z
	.object({
		redirect_url: z.string().url().openapi({
			example: "https://example.okta.com/app/abc123/sso/saml?SAMLRequest=...",
			description: "URL to redirect the user to for IdP authentication",
		}),
		request_id: z.string().openapi({
			example: "_550e8400-e29b-41d4-a716-446655440000",
			description: "AuthnRequest ID for tracking",
		}),
	})
	.openapi({ ref: "SamlSsoResponse" });

export const samlAcsRequestSchema = z
	.object({
		SAMLResponse: z.string().min(1).openapi({
			description: "Base64-encoded SAML Response from the IdP",
		}),
		RelayState: z.string().optional().openapi({
			description: "Optional relay state for redirect after authentication",
		}),
	})
	.openapi({ ref: "SamlAcsRequest" });
