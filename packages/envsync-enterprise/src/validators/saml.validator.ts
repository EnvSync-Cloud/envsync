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
		entity_id: z.string().url().optional().openapi({
			example: "http://www.okta.com/exk123456789",
			description: "SAML entity ID (issuer) from the IdP metadata",
		}),
		sso_url: z.string().url().optional().openapi({
			example: "https://example.okta.com/app/abc123/sso/saml",
			description: "IdP SSO login URL",
		}),
		certificate: z.string().min(1).optional().openapi({
			example: "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----",
			description: "IdP X.509 certificate (PEM format) for signature validation",
		}),
		idp_metadata_xml: z.string().min(1).optional().openapi({
			description: "Optional IdP metadata XML. When set, entity_id, sso_url, and certificate are parsed from it.",
		}),
		is_default: z.boolean().optional().openapi({
			example: true,
			description: "Mark this provider as the default IdP for the organization",
		}),
	})
	.superRefine((value, ctx) => {
		if (!value.idp_metadata_xml && (!value.entity_id || !value.sso_url || !value.certificate)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Provide idp_metadata_xml or entity_id, sso_url, and certificate",
			});
		}
	})
	.openapi({ ref: "CreateSamlProviderRequest" });

export const updateSamlProviderRequestSchema = z
	.object({
		name: z.string().min(1).max(255).optional().openapi({ example: "Okta Production" }),
		entity_id: z.string().url().optional().openapi({ example: "http://www.okta.com/exk123456789" }),
		sso_url: z.string().url().optional().openapi({ example: "https://example.okta.com/app/abc123/sso/saml" }),
		certificate: z.string().min(1).optional().openapi({ example: "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----" }),
		enabled: z.boolean().optional().openapi({ example: true }),
		is_default: z.boolean().optional().openapi({ example: true }),
		idp_metadata_xml: z.string().min(1).optional(),
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
		certificate: z.string().optional().openapi({ example: "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----" }),
		certificate_fingerprint: z.string().optional().openapi({ example: "A1:B2:C3:D4" }),
		certificate_not_after: z.string().nullable().optional().openapi({ example: "2035-01-01T00:00:00.000Z" }),
		enabled: z.boolean().openapi({ example: true }),
		is_default: z.boolean().openapi({ example: false }),
		last_sso_at: z.string().nullable().optional().openapi({ example: "2026-09-13T00:00:00.000Z" }),
		created_at: z.string().openapi({ example: "2025-01-01T00:00:00Z" }),
		updated_at: z.string().openapi({ example: "2025-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "SamlProviderResponse" });

export const samlProvidersResponseSchema = z
	.array(samlProviderResponseSchema)
	.openapi({ ref: "SamlProvidersResponse" });

export const publicSamlSsoRequestSchema = z
	.object({
		provider_id: z.string().uuid().optional().openapi({
			example: "550e8400-e29b-41d4-a716-446655440000",
			description: "Optional SAML provider ID. Must belong to the organization and be enabled.",
		}),
	})
	.openapi({ ref: "PublicSamlSsoRequest" });

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
		RelayState: z.string().min(1).openapi({
			description: "Signed RelayState binding the ACS response to the stored AuthnRequest",
		}),
	})
	.openapi({ ref: "SamlAcsRequest" });
