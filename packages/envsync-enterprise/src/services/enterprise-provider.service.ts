import { ValidationError } from "@/libs/errors";

export const enterpriseProviders = [
	"github",
	"gitlab",
	"aws-ssm",
	"vercel",
	"google-secret-manager",
	"azure-key-vault",
	"aws-secrets-manager",
	"cloudflare-workers",
	"circleci",
	"jenkins",
	"azure-devops",
	"bitbucket",
	"travisci",
	"netlify",
	"railway",
	"fly-io",
	"render",
	"supabase",
	"digitalocean-app-platform",
	"azure-app-service",
	"codefresh",
	"deno-deploy",
	"harness",
	"hasura-cloud",
	"heroku",
	"laravel-forge",
	"qovery",
	"terraform-cloud",
] as const;

export type EnterpriseProvider = typeof enterpriseProviders[number];

type JsonRecord = Record<string, unknown>;

export interface EnterpriseProviderProfile {
	id: EnterpriseProvider;
	name: string;
	scope: string;
	description: string;
	connection_requirements: string[];
	binding_metadata_fields: string[];
	mapping_requirements: string[];
}

const providerProfiles: Record<EnterpriseProvider, EnterpriseProviderProfile> = {
	github: {
		id: "github",
		name: "GitHub",
		scope: "repository-secrets",
		description: "Maps application env types to GitHub repositories and branch-aware repo secret targets.",
		connection_requirements: [
			"Active connections should declare owner/account context and a secret or token reference in auth_config.",
		],
		binding_metadata_fields: ["repository_visibility", "default_secret_prefix", "secret_name_template"],
		mapping_requirements: [
			"target_identifier should point to owner/repo or another GitHub repository target identifier.",
			"branch_ref is required and should match the repository branch or ref used for the mapping.",
		],
	},
	gitlab: {
		id: "gitlab",
		name: "GitLab",
		scope: "project-variables",
		description: "Maps application env types to GitLab projects or groups with branch-aware variable targeting.",
		connection_requirements: [
			"Active connections should declare group/account context and a secret or token reference in auth_config.",
		],
		binding_metadata_fields: ["group_path", "variable_scope", "secret_name_template"],
		mapping_requirements: [
			"target_identifier should point to a GitLab project/group path.",
			"branch_ref is required and should match the environment or ref that the variables apply to.",
		],
	},
	"aws-ssm": {
		id: "aws-ssm",
		name: "AWS SSM",
		scope: "parameter-store",
		description: "Maps application env types to AWS SSM Parameter Store paths and prefixes.",
		connection_requirements: [
			"Active connections should declare a region plus either a credential secret reference or an assumed role in auth_config.",
		],
		binding_metadata_fields: ["region", "kms_key_id", "path_strategy"],
		mapping_requirements: [
			"target_identifier should describe the logical target or parameter namespace.",
			"path_prefix is required and should begin with '/'.",
		],
	},
	vercel: {
		id: "vercel",
		name: "Vercel",
		scope: "project-environments",
		description: "Maps application env types to Vercel projects and deployment environments.",
		connection_requirements: [
			"Active connections should declare a token reference and optionally a team scope in auth_config.",
		],
		binding_metadata_fields: ["team_id", "project_id", "secret_name_template"],
		mapping_requirements: [
			"target_identifier should describe the Vercel project target.",
			"branch_ref is required and acts as the Vercel environment selector for the mapping.",
		],
	},
	"google-secret-manager": {
		id: "google-secret-manager",
		name: "Google Secret Manager",
		scope: "secret-manager",
		description: "Maps application env types to Google Secret Manager projects and optional namespace or prefix rules.",
		connection_requirements: [
			"Active connections should declare project or workload-identity context and a service-account reference in auth_config.",
		],
		binding_metadata_fields: ["project_id", "replication_policy", "secret_name_template"],
		mapping_requirements: [
			"target_identifier should describe the GCP project or logical secret namespace.",
			"path_prefix is optional and can be used as a secret-name prefix.",
		],
	},
	"azure-key-vault": {
		id: "azure-key-vault",
		name: "Azure Key Vault",
		scope: "key-vault",
		description: "Maps application env types to Azure Key Vault secrets with vault-level targeting.",
		connection_requirements: [
			"Active connections should declare tenant_id, client_id, and a client_secret reference in auth_config.",
		],
		binding_metadata_fields: ["vault_url", "tenant_id", "secret_name_template"],
		mapping_requirements: [
			"target_identifier should describe the Azure Key Vault name or URL.",
			"path_prefix is optional and can be used as a secret-name prefix.",
		],
	},
	"aws-secrets-manager": {
		id: "aws-secrets-manager",
		name: "AWS Secrets Manager",
		scope: "secrets-manager",
		description: "Maps application env types to AWS Secrets Manager secrets with path-based organization.",
		connection_requirements: [
			"Active connections should declare a region plus either a credential secret reference or an assumed role in auth_config.",
		],
		binding_metadata_fields: ["region", "kms_key_id", "secret_name_template"],
		mapping_requirements: [
			"target_identifier should describe the logical secret namespace or ARN prefix.",
			"path_prefix is optional and can be used as a secret-name prefix.",
		],
	},
	"cloudflare-workers": {
		id: "cloudflare-workers",
		name: "Cloudflare Workers",
		scope: "worker-secrets",
		description: "Maps application env types to Cloudflare Worker secrets and environment variables.",
		connection_requirements: [
			"Active connections should declare an API token reference and account ID in auth_config.",
		],
		binding_metadata_fields: ["account_id", "secret_name_template"],
		mapping_requirements: [
			"target_identifier should describe the Cloudflare Worker script name.",
			"branch_ref is optional and can target a specific worker environment.",
		],
	},
	circleci: {
		id: "circleci",
		name: "CircleCI",
		scope: "project-env-vars",
		description: "Maps application env types to CircleCI project environment variables.",
		connection_requirements: [
			"Active connections should declare a CircleCI API token reference in auth_config.",
		],
		binding_metadata_fields: ["vcs_type", "secret_name_template"],
		mapping_requirements: [
			"target_identifier should point to the CircleCI project slug (e.g. github/org/repo).",
			"branch_ref is optional and can target a specific CircleCI context or branch.",
		],
	},
	jenkins: {
		id: "jenkins",
		name: "Jenkins",
		scope: "credentials",
		description: "Maps application env types to Jenkins credential store entries.",
		connection_requirements: [
			"Active connections should declare a Jenkins base URL and API token or user reference in auth_config.",
		],
		binding_metadata_fields: ["folder_path", "credential_domain", "secret_name_template"],
		mapping_requirements: [
			"target_identifier should describe the Jenkins job or folder path.",
			"branch_ref is optional and can target a specific branch for scoped credentials.",
		],
	},
	"azure-devops": {
		id: "azure-devops",
		name: "Azure DevOps",
		scope: "variable-groups",
		description: "Maps application env types to Azure DevOps variable groups and pipeline variables.",
		connection_requirements: [
			"Active connections should declare an Azure DevOps organization and PAT token reference in auth_config.",
		],
		binding_metadata_fields: ["project_name", "secret_name_template"],
		mapping_requirements: [
			"target_identifier should describe the Azure DevOps project or variable group ID.",
			"branch_ref is optional and can target a specific pipeline or environment.",
		],
	},
	bitbucket: {
		id: "bitbucket",
		name: "Bitbucket Pipelines",
		scope: "deployment-variables",
		description: "Maps application env types to Bitbucket deployment environment variables.",
		connection_requirements: [
			"Active connections should declare a Bitbucket workspace and an app password or OAuth token reference in auth_config.",
		],
		binding_metadata_fields: ["workspace", "secret_name_template"],
		mapping_requirements: [
			"target_identifier should point to the Bitbucket repository slug (workspace/repo).",
			"branch_ref is optional and can target a specific deployment environment.",
		],
	},
	travisci: {
		id: "travisci",
		name: "Travis CI",
		scope: "repo-settings-env-vars",
		description: "Maps application env types to Travis CI repository settings environment variables.",
		connection_requirements: [
			"Active connections should declare a Travis CI API token reference and optionally a base URL in auth_config.",
		],
		binding_metadata_fields: ["vcs_type", "secret_name_template"],
		mapping_requirements: [
			"target_identifier should point to the Travis CI repository slug (owner/repo).",
			"branch_ref is optional and can target a specific Travis CI branch or environment.",
		],
	},
	netlify: {
		id: "netlify",
		name: "Netlify",
		scope: "site-env-vars",
		description: "Maps application env types to Netlify site environment variables.",
		connection_requirements: [
			"Active connections should declare a Netlify API token reference in auth_config.",
		],
		binding_metadata_fields: ["secret_name_template"],
		mapping_requirements: [
			"target_identifier should describe the Netlify site ID or site name.",
			"branch_ref is optional and can target a specific Netlify deploy context.",
		],
	},
	railway: {
		id: "railway",
		name: "Railway",
		scope: "project-env-vars",
		description: "Maps application env types to Railway project and service variables.",
		connection_requirements: [
			"Active connections should declare a Railway API token reference in auth_config.",
		],
		binding_metadata_fields: ["project_id", "secret_name_template"],
		mapping_requirements: [
			"target_identifier should describe the Railway project or service ID.",
			"branch_ref is optional and can target a specific Railway environment.",
		],
	},
	"fly-io": {
		id: "fly-io",
		name: "Fly.io",
		scope: "app-secrets",
		description: "Maps application env types to Fly.io application secrets and environment variables.",
		connection_requirements: [
			"Active connections should declare a Fly.io API token reference in auth_config.",
		],
		binding_metadata_fields: ["secret_name_template"],
		mapping_requirements: [
			"target_identifier should describe the Fly.io application name.",
			"branch_ref is optional and can target a specific Fly.io deployment or machine.",
		],
	},
	render: {
		id: "render",
		name: "Render",
		scope: "service-env-vars",
		description: "Maps application env types to Render service environment variables.",
		connection_requirements: [
			"Active connections should declare a Render API token reference in auth_config.",
		],
		binding_metadata_fields: ["secret_name_template"],
		mapping_requirements: [
			"target_identifier should describe the Render service ID or service name.",
			"branch_ref is optional and can target a specific Render environment.",
		],
	},
	supabase: {
		id: "supabase",
		name: "Supabase",
		scope: "project-secrets",
		description: "Maps application env types to Supabase project secrets and environment variables.",
		connection_requirements: [
			"Active connections should declare a Supabase access token reference and project reference in auth_config.",
		],
		binding_metadata_fields: ["project_ref", "secret_name_template"],
		mapping_requirements: [
			"target_identifier should describe the Supabase project reference.",
			"branch_ref is optional and can target a specific Supabase branch.",
		],
	},
	"digitalocean-app-platform": {
		id: "digitalocean-app-platform",
		name: "DigitalOcean App Platform",
		scope: "app-environment-variables",
		description: "Maps application env types to DigitalOcean App Platform apps and their environment variables.",
		connection_requirements: [
			"Active connections require a token_secret_ref or token in auth_config.",
		],
		binding_metadata_fields: ["secret_name_template"],
		mapping_requirements: [
			"target_identifier should point to a DigitalOcean app ID.",
		],
	},
	"azure-app-service": {
		id: "azure-app-service",
		name: "Azure App Service",
		scope: "app-settings",
		description: "Maps application env types to Azure App Service application settings.",
		connection_requirements: [
			"Active connections require tenant_id, client_id, and client_secret in auth_config.",
		],
		binding_metadata_fields: ["secret_name_template"],
		mapping_requirements: [
			"target_identifier should point to an Azure App Service name or resource ID.",
		],
	},
	codefresh: {
		id: "codefresh",
		name: "Codefresh",
		scope: "pipeline-variables",
		description: "Maps application env types to Codefresh pipeline variables.",
		connection_requirements: [
			"Active connections require an api_token_secret_ref or api_token in auth_config.",
		],
		binding_metadata_fields: ["secret_name_template"],
		mapping_requirements: [
			"target_identifier should point to a Codefresh project or pipeline ID.",
		],
	},
	"deno-deploy": {
		id: "deno-deploy",
		name: "Deno Deploy",
		scope: "project-env-vars",
		description: "Maps application env types to Deno Deploy project environment variables.",
		connection_requirements: [
			"Active connections require a token_secret_ref or token in auth_config.",
		],
		binding_metadata_fields: ["secret_name_template"],
		mapping_requirements: [
			"target_identifier should point to a Deno Deploy project ID.",
		],
	},
	harness: {
		id: "harness",
		name: "Harness",
		scope: "connector-secrets",
		description: "Maps application env types to Harness connector secrets.",
		connection_requirements: [
			"Active connections require an api_key_secret_ref or api_key in auth_config.",
		],
		binding_metadata_fields: ["secret_name_template"],
		mapping_requirements: [
			"target_identifier should point to a Harness connector ID.",
		],
	},
	"hasura-cloud": {
		id: "hasura-cloud",
		name: "Hasura Cloud",
		scope: "project-env-vars",
		description: "Maps application env types to Hasura Cloud project environment variables.",
		connection_requirements: [
			"Active connections require an api_token_secret_ref or api_token in auth_config.",
		],
		binding_metadata_fields: ["secret_name_template"],
		mapping_requirements: [
			"target_identifier should point to a Hasura Cloud project ID.",
		],
	},
	heroku: {
		id: "heroku",
		name: "Heroku",
		scope: "config-vars",
		description: "Maps application env types to Heroku app config vars.",
		connection_requirements: [
			"Active connections require an api_key_secret_ref or api_key in auth_config.",
		],
		binding_metadata_fields: ["secret_name_template"],
		mapping_requirements: [
			"target_identifier should point to a Heroku app name or ID.",
		],
	},
	"laravel-forge": {
		id: "laravel-forge",
		name: "Laravel Forge",
		scope: "server-env-vars",
		description: "Maps application env types to Laravel Forge server environment variables.",
		connection_requirements: [
			"Active connections require an api_token_secret_ref or api_token in auth_config.",
		],
		binding_metadata_fields: ["secret_name_template"],
		mapping_requirements: [
			"target_identifier should point to a Forge server ID.",
		],
	},
	qovery: {
		id: "qovery",
		name: "Qovery",
		scope: "environment-variables",
		description: "Maps application env types to Qovery environment variables.",
		connection_requirements: [
			"Active connections require a token_secret_ref or token in auth_config.",
		],
		binding_metadata_fields: ["secret_name_template"],
		mapping_requirements: [
			"target_identifier should point to a Qovery environment or service ID.",
		],
	},
	"terraform-cloud": {
		id: "terraform-cloud",
		name: "Terraform Cloud",
		scope: "workspace-variables",
		description: "Maps application env types to Terraform Cloud workspace variables.",
		connection_requirements: [
			"Active connections require a token_secret_ref or token in auth_config.",
		],
		binding_metadata_fields: ["secret_name_template"],
		mapping_requirements: [
			"target_identifier should point to a Terraform Cloud workspace name or ID.",
		],
	},
};

function hasString(record: JsonRecord | undefined, ...keys: string[]) {
	return keys.some(key => typeof record?.[key] === "string" && String(record[key]).trim().length > 0);
}

function isEmptyRecord(record: JsonRecord | undefined) {
	return !record || Object.keys(record).length === 0;
}

export class EnterpriseProviderService {
	public static listProviders() {
		return enterpriseProviders.map(provider => providerProfiles[provider]);
	}

	public static getProfile(provider: string): EnterpriseProviderProfile {
		this.assertProvider(provider);
		return providerProfiles[provider];
	}

	public static assertProvider(provider: string): asserts provider is EnterpriseProvider {
		if (!(enterpriseProviders as readonly string[]).includes(provider)) {
			throw new ValidationError(`Unsupported provider type: ${provider}`);
		}
	}

	public static validateProviderConnection(input: {
		provider_type: string;
		status?: "active" | "inactive" | "error";
		auth_config?: JsonRecord;
	}) {
		this.assertProvider(input.provider_type);

		if (input.status !== "inactive" && isEmptyRecord(input.auth_config)) {
			throw new ValidationError(
				`${providerProfiles[input.provider_type].name} connections require auth_config before they can be active.`,
				"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
			);
		}

		switch (input.provider_type) {
			case "github":
			case "gitlab":
				if (
					input.status !== "inactive"
					&& !hasString(input.auth_config, "owner", "account", "group_path", "token_secret_ref", "installation_id", "app_id")
				) {
					throw new ValidationError(
						`${providerProfiles[input.provider_type].name} connections require owner/account context or a credential reference in auth_config.`,
						"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
					);
				}
				break;
			case "aws-ssm":
				if (
					input.status !== "inactive"
					&& (
						!hasString(input.auth_config, "region")
						|| !hasString(input.auth_config, "credential_secret_ref", "access_key_secret_ref", "role_arn")
					)
				) {
					throw new ValidationError(
						"AWS SSM connections require region and a credential reference or role_arn in auth_config.",
						"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
					);
				}
				break;
			case "vercel":
				if (input.status !== "inactive" && !hasString(input.auth_config, "token_secret_ref", "team_id", "project_id")) {
					throw new ValidationError(
						"Vercel connections require a token or team/project reference in auth_config.",
						"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
					);
				}
				break;
		case "google-secret-manager":
			if (
				input.status !== "inactive"
				&& !hasString(input.auth_config, "project_id", "service_account_secret_ref", "workload_identity_provider")
			) {
				throw new ValidationError(
					"Google Secret Manager connections require project or workload identity context in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "azure-key-vault":
			if (
				input.status !== "inactive"
				&& !hasString(input.auth_config, "tenant_id", "client_id", "client_secret_secret_ref", "vault_url")
			) {
				throw new ValidationError(
					"Azure Key Vault connections require tenant_id, client_id, and a client_secret reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "aws-secrets-manager":
			if (
				input.status !== "inactive"
				&& (
					!hasString(input.auth_config, "region")
					|| !hasString(input.auth_config, "credential_secret_ref", "access_key_secret_ref", "role_arn")
				)
			) {
				throw new ValidationError(
					"AWS Secrets Manager connections require region and a credential reference or role_arn in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "cloudflare-workers":
			if (input.status !== "inactive" && !hasString(input.auth_config, "api_token_secret_ref", "account_id")) {
				throw new ValidationError(
					"Cloudflare Workers connections require an API token reference and account_id in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "circleci":
			if (input.status !== "inactive" && !hasString(input.auth_config, "api_token_secret_ref", "api_token")) {
				throw new ValidationError(
					"CircleCI connections require an API token reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "jenkins":
			if (
				input.status !== "inactive"
				&& !hasString(input.auth_config, "base_url", "api_token_secret_ref", "api_token")
			) {
				throw new ValidationError(
					"Jenkins connections require a base_url and API token reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "azure-devops":
			if (
				input.status !== "inactive"
				&& !hasString(input.auth_config, "organization", "pat_token_secret_ref", "pat_token")
			) {
				throw new ValidationError(
					"Azure DevOps connections require an organization and PAT token reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "bitbucket":
			if (
				input.status !== "inactive"
				&& !hasString(input.auth_config, "workspace", "app_password_secret_ref", "app_password", "oauth_token_secret_ref")
			) {
				throw new ValidationError(
					"Bitbucket connections require a workspace and credential reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "travisci":
			if (input.status !== "inactive" && !hasString(input.auth_config, "api_token_secret_ref", "api_token")) {
				throw new ValidationError(
					"Travis CI connections require an API token reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "netlify":
			if (input.status !== "inactive" && !hasString(input.auth_config, "token_secret_ref", "token")) {
				throw new ValidationError(
					"Netlify connections require a personal access token reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "railway":
			if (input.status !== "inactive" && !hasString(input.auth_config, "token_secret_ref", "token")) {
				throw new ValidationError(
					"Railway connections require an API token reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "fly-io":
			if (input.status !== "inactive" && !hasString(input.auth_config, "token_secret_ref", "token")) {
				throw new ValidationError(
					"Fly.io connections require an API token reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "render":
			if (input.status !== "inactive" && !hasString(input.auth_config, "api_key_secret_ref", "api_key")) {
				throw new ValidationError(
					"Render connections require an API key reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "supabase":
			if (input.status !== "inactive" && !hasString(input.auth_config, "access_token_secret_ref", "access_token")) {
				throw new ValidationError(
					"Supabase connections require a management API access token reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "digitalocean-app-platform":
			if (input.status !== "inactive" && !hasString(input.auth_config, "token_secret_ref", "token")) {
				throw new ValidationError(
					"DigitalOcean App Platform connections require an API token reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "azure-app-service":
			if (input.status !== "inactive" && !hasString(input.auth_config, "tenant_id", "client_id", "client_secret_secret_ref")) {
				throw new ValidationError(
					"Azure App Service connections require tenant_id, client_id, and a client_secret reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "codefresh":
			if (input.status !== "inactive" && !hasString(input.auth_config, "api_token_secret_ref", "api_token")) {
				throw new ValidationError(
					"Codefresh connections require an API token reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "deno-deploy":
			if (input.status !== "inactive" && !hasString(input.auth_config, "token_secret_ref", "token")) {
				throw new ValidationError(
					"Deno Deploy connections require a token reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "harness":
			if (input.status !== "inactive" && !hasString(input.auth_config, "api_key_secret_ref", "api_key")) {
				throw new ValidationError(
					"Harness connections require an API key reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "hasura-cloud":
			if (input.status !== "inactive" && !hasString(input.auth_config, "api_token_secret_ref", "api_token")) {
				throw new ValidationError(
					"Hasura Cloud connections require an API token reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "heroku":
			if (input.status !== "inactive" && !hasString(input.auth_config, "api_key_secret_ref", "api_key")) {
				throw new ValidationError(
					"Heroku connections require an API key reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "laravel-forge":
			if (input.status !== "inactive" && !hasString(input.auth_config, "api_token_secret_ref", "api_token")) {
				throw new ValidationError(
					"Laravel Forge connections require an API token reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "qovery":
			if (input.status !== "inactive" && !hasString(input.auth_config, "token_secret_ref", "token")) {
				throw new ValidationError(
					"Qovery connections require a token reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		case "terraform-cloud":
			if (input.status !== "inactive" && !hasString(input.auth_config, "token_secret_ref", "token")) {
				throw new ValidationError(
					"Terraform Cloud connections require a token reference in auth_config.",
					"ENTERPRISE_PROVIDER_CONNECTION_INVALID",
				);
			}
			break;
		}
	}

	public static validateBinding(input: {
		provider_type: string;
		connection_provider_type: string;
		metadata?: JsonRecord;
	}) {
		this.assertProvider(input.provider_type);
		this.assertProvider(input.connection_provider_type);

		if (input.provider_type !== input.connection_provider_type) {
			throw new ValidationError(
				`Binding provider ${input.provider_type} does not match connection provider ${input.connection_provider_type}.`,
				"ENTERPRISE_BINDING_PROVIDER_MISMATCH",
			);
		}

		if (input.metadata && typeof input.metadata !== "object") {
			throw new ValidationError("Binding metadata must be a JSON object.", "ENTERPRISE_BINDING_INVALID");
		}
	}

	public static validateMapping(input: {
		provider_type: string;
		target_identifier: string;
		branch_ref?: string | null;
		path_prefix?: string | null;
		metadata?: JsonRecord;
	}) {
		this.assertProvider(input.provider_type);

		if (!input.target_identifier.trim()) {
			throw new ValidationError("target_identifier is required.", "ENTERPRISE_MAPPING_INVALID");
		}

		switch (input.provider_type) {
			case "github":
			case "gitlab":
				if (!input.branch_ref?.trim()) {
					throw new ValidationError(
						`${providerProfiles[input.provider_type].name} mappings require branch_ref.`,
						"ENTERPRISE_MAPPING_INVALID",
					);
				}
				break;
			case "vercel":
				if (!input.branch_ref?.trim()) {
					throw new ValidationError(
						"Vercel mappings require branch_ref as the environment selector.",
						"ENTERPRISE_MAPPING_INVALID",
					);
				}
				break;
			case "aws-ssm":
				if (!input.path_prefix?.trim() || !input.path_prefix.startsWith("/")) {
					throw new ValidationError(
						"AWS SSM mappings require path_prefix and it must start with '/'.",
						"ENTERPRISE_MAPPING_INVALID",
					);
				}
				break;
		case "google-secret-manager":
			break;
		case "azure-key-vault":
			break;
		case "aws-secrets-manager":
			break;
		case "cloudflare-workers":
			break;
		case "circleci":
			break;
		case "jenkins":
			break;
		case "azure-devops":
			break;
		case "bitbucket":
			break;
		case "travisci":
			break;
		case "netlify":
			break;
		case "railway":
			break;
		case "fly-io":
			break;
		case "render":
			break;
		case "supabase":
			break;
		case "digitalocean-app-platform":
			break;
		}

		if (input.metadata && typeof input.metadata !== "object") {
			throw new ValidationError("Mapping metadata must be a JSON object.", "ENTERPRISE_MAPPING_INVALID");
		}
	}

	public static buildTargetDescriptor(input: {
		provider_type: EnterpriseProvider;
		target_identifier: string;
		branch_ref?: string | null;
		path_prefix?: string | null;
	}) {
		switch (input.provider_type) {
			case "github":
				return {
					repository: input.target_identifier,
					ref: input.branch_ref ?? null,
					scope: "repo_secret",
				};
			case "gitlab":
				return {
					project: input.target_identifier,
					ref: input.branch_ref ?? null,
					scope: "project_variable",
				};
			case "vercel":
				return {
					project: input.target_identifier,
					environment: input.branch_ref ?? null,
					scope: "vercel_env",
				};
			case "aws-ssm":
				return {
					target: input.target_identifier,
					path_prefix: input.path_prefix ?? null,
					scope: "parameter_store",
				};
		case "google-secret-manager":
			return {
				project: input.target_identifier,
				secret_prefix: input.path_prefix ?? null,
				scope: "secret_manager",
			};
		case "azure-key-vault":
			return {
				vault: input.target_identifier,
				secret_prefix: input.path_prefix ?? null,
				scope: "key_vault",
			};
		case "aws-secrets-manager":
			return {
				target: input.target_identifier,
				secret_prefix: input.path_prefix ?? null,
				scope: "secrets_manager",
			};
		case "cloudflare-workers":
			return {
				script: input.target_identifier,
				environment: input.branch_ref ?? null,
				scope: "worker_secrets",
			};
		case "circleci":
			return {
				project: input.target_identifier,
				ref: input.branch_ref ?? null,
				scope: "project_env_var",
			};
		case "jenkins":
			return {
				job: input.target_identifier,
				branch: input.branch_ref ?? null,
				scope: "credentials",
			};
		case "azure-devops":
			return {
				project: input.target_identifier,
				ref: input.branch_ref ?? null,
				scope: "variable_group",
			};
		case "bitbucket":
			return {
				repository: input.target_identifier,
				environment: input.branch_ref ?? null,
				scope: "deployment_variable",
			};
		case "travisci":
			return {
				repository: input.target_identifier,
				branch: input.branch_ref ?? null,
				scope: "repo_env_var",
			};
		}
	}
}
