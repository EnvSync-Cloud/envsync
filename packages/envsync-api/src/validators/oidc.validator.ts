import z from "zod";
import "zod-openapi/extend";

const providerTypeEnum = z.enum(["github_actions", "gitlab_ci", "kubernetes", "generic"]);

export const createOidcProviderRequestSchema = z
	.object({
		provider_type: providerTypeEnum.openapi({
			example: "github_actions",
			description: "CI/CD platform type",
		}),
		issuer_url: z.string().url().openapi({
			example: "https://token.actions.githubusercontent.com",
			description: "OIDC issuer URL",
		}),
		audience: z.string().min(1).openapi({
			example: "https://envsync.cloud",
			description: "Expected audience claim value",
		}),
		allowed_subjects: z
			.array(z.string())
			.optional()
			.default([])
			.openapi({
				example: ["repo:myorg/myrepo:*"],
				description:
					"Subject patterns to allow (glob matching). Empty = allow all subjects from this issuer.",
			}),
	})
	.openapi({ ref: "CreateOidcProviderRequest" });

export const updateOidcProviderRequestSchema = z
	.object({
		audience: z.string().min(1).optional().openapi({
			example: "https://envsync.cloud",
		}),
		enabled: z.boolean().optional().openapi({ example: true }),
		allowed_subjects: z.array(z.string()).optional().openapi({
			example: ["repo:myorg/myrepo:*"],
		}),
	})
	.openapi({ ref: "UpdateOidcProviderRequest" });

export const oidcProviderResponseSchema = z
	.object({
		id: z.string().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
		org_id: z.string().openapi({ example: "org_abc123" }),
		provider_type: providerTypeEnum.openapi({ example: "github_actions" }),
		issuer_url: z.string().openapi({ example: "https://token.actions.githubusercontent.com" }),
		audience: z.string().openapi({ example: "https://envsync.cloud" }),
		enabled: z.boolean().openapi({ example: true }),
		allowed_subjects: z.array(z.string()).openapi({ example: ["repo:myorg/myrepo:*"] }),
		machine_user_id: z.string().nullable().openapi({ example: "user_xyz" }),
		created_at: z.string().openapi({ example: "2025-01-01T00:00:00Z" }),
		updated_at: z.string().openapi({ example: "2025-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "OidcProviderResponse" });

export const oidcProvidersResponseSchema = z
	.array(oidcProviderResponseSchema)
	.openapi({ ref: "OidcProvidersResponse" });
