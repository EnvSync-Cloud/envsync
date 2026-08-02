import { PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { importPKCS8, SignJWT } from "jose";
import sodium from "libsodium-wrappers";

import { DB } from "envsync-api/ports/db";
import { NotFoundError, ValidationError } from "envsync-api/ports/errors";

import { type EnterpriseProvider } from "./enterprise-provider.service";

type JsonRecord = Record<string, unknown>;

export interface EnterpriseSyncItem {
	key: string;
	value: string;
	kind: "env" | "secret";
}

export interface EnterpriseSyncContext {
	org_id: string;
	app_id: string;
	env_type_id: string;
	provider_type: EnterpriseProvider;
	connection: {
		id: string;
		name: string;
		provider_type: EnterpriseProvider;
		auth_config: JsonRecord;
		metadata: JsonRecord;
	};
	binding: {
		id: string;
		metadata: JsonRecord;
	};
	mapping: {
		id: string;
		target_identifier: string;
		branch_ref: string | null;
		path_prefix: string | null;
		metadata: JsonRecord;
	};
	items: EnterpriseSyncItem[];
}

export interface EnterpriseSyncResult {
	written_count: number;
	target: Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const strings = value.filter(item => typeof item === "string" && item.trim().length > 0).map(item => item.trim());
	return strings.length > 0 ? strings : undefined;
}

function sanitizeSecretKey(key: string) {
	return key.replace(/[^A-Za-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
}

function sanitizeGoogleSecretId(key: string) {
	const normalized = key.replace(/[^A-Za-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
	return normalized || "ENVSYNC_SECRET";
}

async function fetchJson(url: string, init: RequestInit, allowStatuses: number[] = []) {
	const response = await fetch(url, init);
	if (allowStatuses.includes(response.status)) {
		return { response, body: null as unknown };
	}

	const text = await response.text();
	let body: unknown = null;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		body = text;
	}

	if (!response.ok) {
		const message = typeof body === "object" && body && "message" in body
			? String((body as { message?: unknown }).message)
			: typeof body === "string" && body
				? body
				: response.statusText;
		throw new ValidationError(`Provider request failed: ${message}`, "ENTERPRISE_PROVIDER_SYNC_FAILED");
	}

	return { response, body };
}

export class EnterpriseProviderSyncService {
	private static async getOrgSecretValue(org_id: string, key: string) {
		const db = await DB.getInstance();
		const secret = await db
			.selectFrom("org_secret")
			.selectAll()
			.where("org_id", "=", org_id)
			.where("key", "=", key)
			.executeTakeFirst();
		if (!secret) {
			throw new NotFoundError("OrgSecret", key, "ENTERPRISE_ORG_SECRET_NOT_FOUND");
		}
		return secret.value;
	}

	private static async resolveConfigValue(org_id: string, config: JsonRecord, key: string) {
		const direct = asString(config[key]);
		if (direct) {
			return direct;
		}

		const secretRef = asString(config[`${key}_secret_ref`]);
		if (secretRef) {
			return this.getOrgSecretValue(org_id, secretRef);
		}

		return undefined;
	}

	private static buildRemoteKey(item: EnterpriseSyncItem, context: EnterpriseSyncContext) {
		const prefix = asString(context.binding.metadata.name_prefix)
			?? asString(context.mapping.metadata.name_prefix)
			?? asString(context.connection.metadata.name_prefix);
		const baseKey = prefix ? `${prefix}_${item.key}` : item.key;
		return sanitizeSecretKey(baseKey);
	}

	private static getGithubRepo(target_identifier: string) {
		const [owner, repo] = target_identifier.split("/");
		if (!owner || !repo) {
			throw new ValidationError(
				"GitHub target_identifier must be in owner/repo format.",
				"ENTERPRISE_GITHUB_TARGET_INVALID",
			);
		}
		return { owner, repo };
	}

	private static getGitlabBaseUrl(auth_config: JsonRecord) {
		return asString(auth_config.base_url) ?? "https://gitlab.com";
	}

	private static getVercelBaseUrl(auth_config: JsonRecord) {
		return asString(auth_config.base_url) ?? "https://api.vercel.com";
	}

	private static async syncGithub(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "token");
		if (!token) {
			throw new ValidationError("GitHub connection requires token or token_secret_ref.", "ENTERPRISE_GITHUB_AUTH_MISSING");
		}

		const { owner, repo } = this.getGithubRepo(context.mapping.target_identifier);
		const headers = {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"X-GitHub-Api-Version": "2022-11-28",
			"Content-Type": "application/json",
		};

		const { body: publicKeyBody } = await fetchJson(
			`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/secrets/public-key`,
			{ method: "GET", headers },
		);
		const publicKey = publicKeyBody as { key: string; key_id: string };

		await sodium.ready;
		const keyBytes = sodium.from_base64(publicKey.key, sodium.base64_variants.ORIGINAL);

		for (const item of context.items) {
			const secretName = this.buildRemoteKey(item, context);
			const encrypted = sodium.crypto_box_seal(sodium.from_string(item.value), keyBytes);
			const encryptedValue = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL);

			await fetchJson(
				`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/secrets/${encodeURIComponent(secretName)}`,
				{
					method: "PUT",
					headers,
					body: JSON.stringify({
						encrypted_value: encryptedValue,
						key_id: publicKey.key_id,
					}),
				},
			);
		}

		return {
			written_count: context.items.length,
			target: {
				repository: `${owner}/${repo}`,
				ref: context.mapping.branch_ref,
				scope: "repo_secret",
			},
		};
	}

	private static async syncGitlab(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "token");
		if (!token) {
			throw new ValidationError("GitLab connection requires token or token_secret_ref.", "ENTERPRISE_GITLAB_AUTH_MISSING");
		}

		const baseUrl = this.getGitlabBaseUrl(context.connection.auth_config).replace(/\/$/, "");
		const projectId = encodeURIComponent(context.mapping.target_identifier);
		const environmentScope = context.mapping.branch_ref ?? "*";

		for (const item of context.items) {
			const key = this.buildRemoteKey(item, context);
			const body = new URLSearchParams({
				key,
				value: item.value,
				environment_scope: environmentScope,
				raw: "true",
				masked: item.kind === "secret" ? "true" : "false",
				protected: asString(context.mapping.metadata.protected) === "true" ? "true" : "false",
				variable_type: "env_var",
			});

			const updateUrl = `${baseUrl}/api/v4/projects/${projectId}/variables/${encodeURIComponent(key)}`;
			const updateResponse = await fetch(updateUrl, {
				method: "PUT",
				headers: {
					"PRIVATE-TOKEN": token,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					...Object.fromEntries(body.entries()),
					"filter[environment_scope]": environmentScope,
				}),
			});

			if (updateResponse.status === 404) {
				await fetchJson(
					`${baseUrl}/api/v4/projects/${projectId}/variables`,
					{
						method: "POST",
						headers: {
							"PRIVATE-TOKEN": token,
							"Content-Type": "application/x-www-form-urlencoded",
						},
						body,
					},
				);
				continue;
			}

			const updateText = await updateResponse.text();
			if (!updateResponse.ok) {
				let message = updateResponse.statusText;
				try {
					const parsed = updateText ? JSON.parse(updateText) as { message?: unknown } : null;
					if (parsed?.message) {
						message = typeof parsed.message === "string" ? parsed.message : JSON.stringify(parsed.message);
					}
				} catch {
					if (updateText) {
						message = updateText;
					}
				}
				throw new ValidationError(`Provider request failed: ${message}`, "ENTERPRISE_PROVIDER_SYNC_FAILED");
			}
		}

		return {
			written_count: context.items.length,
			target: {
				project: context.mapping.target_identifier,
				environment_scope: environmentScope,
			},
		};
	}

	private static async syncVercel(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "token");
		if (!token) {
			throw new ValidationError("Vercel connection requires token or token_secret_ref.", "ENTERPRISE_VERCEL_AUTH_MISSING");
		}

		const baseUrl = this.getVercelBaseUrl(context.connection.auth_config).replace(/\/$/, "");
		const project = encodeURIComponent(context.mapping.target_identifier);
		const teamId = asString(context.connection.auth_config.team_id) ?? asString(context.binding.metadata.team_id);
		const slug = asString(context.connection.auth_config.slug) ?? asString(context.binding.metadata.slug);
		const customEnvironmentIds = asStringArray(context.mapping.metadata.customEnvironmentIds);
		const query = new URLSearchParams({ upsert: "true" });
		if (teamId) query.set("teamId", teamId);
		if (slug) query.set("slug", slug);

		let targets = asStringArray(context.mapping.metadata.targets);
		if (!targets) {
			const branchRef = context.mapping.branch_ref ?? "";
			if (["production", "preview", "development"].includes(branchRef)) {
				targets = [branchRef];
			} else {
				targets = ["preview"];
			}
		}

		for (const item of context.items) {
			await fetchJson(
				`${baseUrl}/v10/projects/${project}/env?${query.toString()}`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						key: this.buildRemoteKey(item, context),
						value: item.value,
						type: item.kind === "secret" ? "encrypted" : "plain",
						target: targets,
						gitBranch: context.mapping.branch_ref ?? undefined,
						customEnvironmentIds,
						comment: asString(context.mapping.metadata.comment) ?? undefined,
					}),
				},
			);
		}

		return {
			written_count: context.items.length,
			target: {
				project: context.mapping.target_identifier,
				targets,
				gitBranch: context.mapping.branch_ref,
			},
		};
	}

	private static async syncAwsSsm(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const region = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "region");
		if (!region) {
			throw new ValidationError("AWS SSM connection requires region.", "ENTERPRISE_AWS_SSM_CONFIG_MISSING");
		}

		const accessKeyId = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "access_key_id");
		const secretAccessKey = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "secret_access_key");
		if (!accessKeyId || !secretAccessKey) {
			throw new ValidationError(
				"AWS SSM connection requires access_key_id and secret_access_key or matching secret refs.",
				"ENTERPRISE_AWS_SSM_AUTH_MISSING",
			);
		}

		const client = new SSMClient({
			region,
			credentials: {
				accessKeyId,
				secretAccessKey,
				sessionToken: await this.resolveConfigValue(context.org_id, context.connection.auth_config, "session_token"),
			},
		});

		const prefix = context.mapping.path_prefix ?? "/";
		const normalizedPrefix = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
		const targetPrefix = context.mapping.target_identifier.replace(/^\/+|\/+$/g, "");
		const kmsKeyId = asString(context.mapping.metadata.kms_key_id)
			?? asString(context.binding.metadata.kms_key_id)
			?? asString(context.connection.auth_config.kms_key_id);

		for (const item of context.items) {
			const name = `${normalizedPrefix}/${targetPrefix}/${this.buildRemoteKey(item, context)}`.replace(/\/+/g, "/");
			await client.send(new PutParameterCommand({
				Name: name,
				Value: item.value,
				Type: "SecureString",
				Overwrite: true,
				KeyId: kmsKeyId,
			}));
		}

		return {
			written_count: context.items.length,
			target: {
				path_prefix: normalizedPrefix,
				target: context.mapping.target_identifier,
				region,
			},
		};
	}

	private static async getGoogleAccessToken(serviceAccountJson: string) {
		const credentials = JSON.parse(serviceAccountJson) as {
			client_email?: string;
			private_key?: string;
			token_uri?: string;
		};
		if (!credentials.client_email || !credentials.private_key) {
			throw new ValidationError(
				"Google Secret Manager service account JSON is missing client_email or private_key.",
				"ENTERPRISE_GSM_AUTH_INVALID",
			);
		}

		const now = Math.floor(Date.now() / 1000);
		const key = await importPKCS8(credentials.private_key, "RS256");
		const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/cloud-platform" })
			.setProtectedHeader({ alg: "RS256", typ: "JWT" })
			.setIssuer(credentials.client_email)
			.setSubject(credentials.client_email)
			.setAudience(credentials.token_uri ?? "https://oauth2.googleapis.com/token")
			.setIssuedAt(now)
			.setExpirationTime(now + 3600)
			.sign(key);

		const tokenResponse = await fetch(credentials.token_uri ?? "https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
				assertion,
			}),
		});

		const tokenBody = await tokenResponse.json().catch(() => null) as { access_token?: string; error_description?: string } | null;
		if (!tokenResponse.ok || !tokenBody?.access_token) {
			throw new ValidationError(
				`Failed to obtain Google access token: ${tokenBody?.error_description ?? tokenResponse.statusText}`,
				"ENTERPRISE_GSM_AUTH_INVALID",
			);
		}

		return tokenBody.access_token;
	}

	private static async syncGoogleSecretManager(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const serviceAccountJson = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "service_account_json");
		if (!serviceAccountJson) {
			throw new ValidationError(
				"Google Secret Manager connection requires service_account_json or service_account_json_secret_ref.",
				"ENTERPRISE_GSM_AUTH_MISSING",
			);
		}

		const accessToken = await this.getGoogleAccessToken(serviceAccountJson);
		const projectId = context.mapping.target_identifier;
		const prefix = (context.mapping.path_prefix ?? "").replace(/^\/+|\/+$/g, "");

		for (const item of context.items) {
			const secretId = sanitizeGoogleSecretId(prefix ? `${prefix}-${this.buildRemoteKey(item, context)}` : this.buildRemoteKey(item, context));
			const createUrl = `https://secretmanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/secrets?secretId=${encodeURIComponent(secretId)}`;
			const replication = asString(context.connection.auth_config.replication_policy) === "user-managed"
				? { userManaged: { replicas: [{ location: asString(context.connection.auth_config.replica_location) ?? "us-central1" }] } }
				: { automatic: {} };

			const createResponse = await fetch(createUrl, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ replication }),
			});
			if (createResponse.status !== 409 && !createResponse.ok) {
				const body = await createResponse.text();
				throw new ValidationError(`Provider request failed: ${body || createResponse.statusText}`, "ENTERPRISE_PROVIDER_SYNC_FAILED");
			}

			await fetchJson(
				`https://secretmanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/secrets/${encodeURIComponent(secretId)}:addVersion`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${accessToken}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						payload: {
							data: Buffer.from(item.value, "utf-8").toString("base64"),
						},
					}),
				},
			);
		}

		return {
			written_count: context.items.length,
			target: {
				project: projectId,
				secret_prefix: prefix || null,
			},
		};
	}

	private static async syncCircleCI(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "api_token");
		if (!token) {
			throw new ValidationError("CircleCI connection requires api_token or api_token_secret_ref.", "ENTERPRISE_CIRCLECI_AUTH_MISSING");
		}

		const orgId = asString(context.connection.auth_config.org_id);
		if (!orgId) {
			throw new ValidationError("CircleCI connection requires org_id.", "ENTERPRISE_CIRCLECI_ORG_MISSING");
		}

		const projectSlug = context.mapping.target_identifier;
		const contextName = asString(context.mapping.metadata.context_name) ?? "project";

		for (const item of context.items) {
			const key = this.buildRemoteKey(item, context);
			await fetchJson(
				`https://circleci.com/api/v2/context/${encodeURIComponent(orgId)}/environment-variable/${encodeURIComponent(key)}`,
				{
					method: "PUT",
					headers: {
						"Circle-Token": token,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ value: item.value }),
				},
				[404],
			);
		}

		return {
			written_count: context.items.length,
			target: { project: projectSlug, context: contextName },
		};
	}

	private static async syncJenkins(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "api_token");
		if (!token) {
			throw new ValidationError("Jenkins connection requires api_token or api_token_secret_ref.", "ENTERPRISE_JENKINS_AUTH_MISSING");
		}

		const jenkinsUrl = asString(context.connection.auth_config.jenkins_url)?.replace(/\/$/, "");
		if (!jenkinsUrl) {
			throw new ValidationError("Jenkins connection requires jenkins_url.", "ENTERPRISE_JENKINS_URL_MISSING");
		}

		const username = asString(context.connection.auth_config.username) ?? "admin";
		const credentialStore = context.mapping.target_identifier ?? "_";
		const prefix = asString(context.mapping.path_prefix) ?? "";

		for (const item of context.items) {
			const key = this.buildRemoteKey(item, context);
			const credentialId = prefix ? `${prefix}_${key}` : key;

			await fetchJson(
				`${jenkinsUrl}/credentials/store/${encodeURIComponent(credentialStore)}/domain/_/createCredentials`,
				{
					method: "POST",
					headers: {
						Authorization: `Basic ${Buffer.from(`${username}:${token}`).toString("base64")}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						credentials: {
							"@class": "com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl",
							id: credentialId,
							description: `Synced by EnvSync`,
							username: credentialId,
							password: item.value,
						},
					}),
				},
				[409],
			);
		}

		return {
			written_count: context.items.length,
			target: { store: credentialStore, prefix },
		};
	}

	private static async syncAzureDevOps(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const pat = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "pat");
		if (!pat) {
			throw new ValidationError("Azure DevOps connection requires pat or pat_secret_ref.", "ENTERPRISE_AZUREDEVOPS_AUTH_MISSING");
		}

		const orgUrl = asString(context.connection.auth_config.org_url)?.replace(/\/$/, "");
		if (!orgUrl) {
			throw new ValidationError("Azure DevOps connection requires org_url.", "ENTERPRISE_AZUREDEVOPS_URL_MISSING");
		}

		const project = asString(context.binding.metadata.project);
		const groupId = asString(context.binding.metadata.variable_group_id);
		if (!groupId) {
			throw new ValidationError("Azure DevOps binding requires variable_group_id.", "ENTERPRISE_AZUREDEVOPS_GROUP_MISSING");
		}

		const headers = {
			Authorization: `Basic ${Buffer.from(`:${pat}`).toString("base64")}`,
			"Content-Type": "application/json",
		};

		const { body: group } = await fetchJson(
			`${orgUrl}/${project ? `${encodeURIComponent(project)}/` : ""}_apis/distributedtask/variablegroups/${groupId}?api-version=7.1-preview.2`,
			{ method: "GET", headers },
		);
		const variables = (group as { variables?: Record<string, unknown> })?.variables ?? {};

		for (const item of context.items) {
			const key = this.buildRemoteKey(item, context);
			variables[key] = { value: item.value, isSecret: item.kind === "secret" };
		}

		await fetchJson(
			`${orgUrl}/${project ? `${encodeURIComponent(project)}/` : ""}_apis/distributedtask/variablegroups/${groupId}?api-version=7.1-preview.2`,
			{
				method: "PUT",
				headers,
				body: JSON.stringify({ variables }),
			},
		);

		return {
			written_count: context.items.length,
			target: { group_id: groupId, project },
		};
	}

	private static async syncBitbucket(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const appPassword = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "app_password");
		if (!appPassword) {
			throw new ValidationError("Bitbucket connection requires app_password or app_password_secret_ref.", "ENTERPRISE_BITBUCKET_AUTH_MISSING");
		}

		const workspace = asString(context.connection.auth_config.workspace);
		if (!workspace) {
			throw new ValidationError("Bitbucket connection requires workspace.", "ENTERPRISE_BITBUCKET_WORKSPACE_MISSING");
		}

		const repoSlug = context.mapping.target_identifier;
		const environment = asString(context.mapping.metadata.environment) ?? "production";

		const headers = {
			Authorization: `Basic ${Buffer.from(`${workspace}:${appPassword}`).toString("base64")}`,
			"Content-Type": "application/json",
		};

		for (const item of context.items) {
			const key = this.buildRemoteKey(item, context);
			await fetchJson(
				`https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repoSlug)}/deployments_config/environments/${encodeURIComponent(environment)}/variables`,
				{
					method: "POST",
					headers,
					body: JSON.stringify({ key, value: item.value, secured: item.kind === "secret" }),
				},
				[409],
			);
		}

		return {
			written_count: context.items.length,
			target: { workspace, repo: repoSlug, environment },
		};
	}

	private static async syncTravisCI(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "api_token");
		if (!token) {
			throw new ValidationError("Travis CI connection requires api_token or api_token_secret_ref.", "ENTERPRISE_TRAVISCI_AUTH_MISSING");
		}

		const repoSlug = context.mapping.target_identifier;
		const headers = {
			Authorization: `token ${token}`,
			"Content-Type": "application/json",
			"Travis-API-Version": "3",
		};

		for (const item of context.items) {
			const key = this.buildRemoteKey(item, context);
			await fetchJson(
				`https://api.travis-ci.com/repo/${encodeURIComponent(repoSlug)}/env_vars`,
				{
					method: "POST",
					headers,
					body: JSON.stringify({ env_var: { name: key, value: item.value, public: item.kind !== "secret" } }),
				},
			);
		}

		return {
			written_count: context.items.length,
			target: { repo: repoSlug },
		};
	}

	private static async syncNetlify(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "api_token");
		if (!token) {
			throw new ValidationError("Netlify connection requires api_token or api_token_secret_ref.", "ENTERPRISE_NETLIFY_AUTH_MISSING");
		}

		const siteId = context.mapping.target_identifier;
		const deployContext = asString(context.mapping.metadata.context) ?? "production";

		const headers = {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		};

		const envVars: Record<string, string> = {};
		for (const item of context.items) {
			envVars[this.buildRemoteKey(item, context)] = item.value;
		}

		await fetchJson(
			`https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/env`,
			{
				method: "PUT",
				headers,
				body: JSON.stringify(envVars),
			},
		);

		return {
			written_count: context.items.length,
			target: { site_id: siteId, context: deployContext },
		};
	}

	private static async syncRailway(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "api_token");
		if (!token) {
			throw new ValidationError("Railway connection requires api_token or api_token_secret_ref.", "ENTERPRISE_RAILWAY_AUTH_MISSING");
		}

		const serviceId = context.mapping.target_identifier;
		const environmentId = asString(context.mapping.metadata.environment_id);

		const headers = {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		};

		const variables: Record<string, string> = {};
		for (const item of context.items) {
			variables[this.buildRemoteKey(item, context)] = item.value;
		}

		await fetchJson(
			`https://backboard.railway.app/graphql/v2`,
			{
				method: "POST",
				headers,
				body: JSON.stringify({
					query: `mutation variableUpsert($input: VariableUpsertInput!) { variableUpsert(input: $input) }`,
					variables: {
						input: {
							serviceId,
							environmentId,
							variables,
						},
					},
				}),
			},
		);

		return {
			written_count: context.items.length,
			target: { service_id: serviceId, environment_id: environmentId },
		};
	}

	private static async syncFlyio(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "api_token");
		if (!token) {
			throw new ValidationError("Fly.io connection requires api_token or api_token_secret_ref.", "ENTERPRISE_FLYIO_AUTH_MISSING");
		}

		const appName = context.mapping.target_identifier;
		const headers = {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			"Fly-Version": "1",
		};

		const secrets: Record<string, string> = {};
		for (const item of context.items) {
			secrets[this.buildRemoteKey(item, context)] = item.value;
		}

		await fetchJson(
			`https://api.fly.io/api/v1/apps/${encodeURIComponent(appName)}/secrets`,
			{
				method: "POST",
				headers,
				body: JSON.stringify({ secrets }),
			},
		);

		return {
			written_count: context.items.length,
			target: { app: appName },
		};
	}

	private static async syncRender(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const apiKey = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "api_key");
		if (!apiKey) {
			throw new ValidationError("Render connection requires api_key or api_key_secret_ref.", "ENTERPRISE_RENDER_AUTH_MISSING");
		}

		const serviceId = context.mapping.target_identifier;
		const headers = {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		};

		for (const item of context.items) {
			const key = this.buildRemoteKey(item, context);
			await fetchJson(
				`https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/env-vars`,
				{
					method: "POST",
					headers,
					body: JSON.stringify({ key, value: item.value }),
				},
				[409],
			);
		}

		return {
			written_count: context.items.length,
			target: { service_id: serviceId },
		};
	}

	private static async syncSupabase(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "access_token");
		if (!token) {
			throw new ValidationError("Supabase connection requires access_token or access_token_secret_ref.", "ENTERPRISE_SUPABASE_AUTH_MISSING");
		}

		const projectRef = context.mapping.target_identifier ?? asString(context.binding.metadata.project_ref);
		if (!projectRef) {
			throw new ValidationError("Supabase binding requires project_ref.", "ENTERPRISE_SUPABASE_PROJECT_MISSING");
		}

		const headers = {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		};

		for (const item of context.items) {
			const key = this.buildRemoteKey(item, context);
			await fetchJson(
				`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/secrets`,
				{
					method: "POST",
					headers,
					body: JSON.stringify([{ name: key, value: item.value }]),
				},
			);
		}

		return {
			written_count: context.items.length,
			target: { project_ref: projectRef },
		};
	}

	private static async syncDigitalOcean(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "api_token");
		if (!token) {
			throw new ValidationError("DigitalOcean connection requires api_token or api_token_secret_ref.", "ENTERPRISE_DIGITALOCEAN_AUTH_MISSING");
		}

		const appId = context.mapping.target_identifier;
		const headers = {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		};

		const { body: app } = await fetchJson(
			`https://api.digitalocean.com/v2/apps/${encodeURIComponent(appId)}`,
			{ method: "GET", headers },
		);
		const spec = (app as { app?: { spec?: Record<string, unknown> } })?.app?.spec ?? {};

		for (const item of context.items) {
			const key = this.buildRemoteKey(item, context);
			const services = (spec.services as Array<{ envs?: Array<Record<string, unknown>> }> | undefined) ?? [];
			for (const service of services) {
				if (!service.envs) service.envs = [];
				const existing = service.envs.find(e => e.key === key);
				if (existing) {
					existing.value = item.value;
				} else {
					service.envs.push({ key, value: item.value, type: item.kind === "secret" ? "SECRET" : "GENERAL" });
				}
			}
		}

		await fetchJson(
			`https://api.digitalocean.com/v2/apps/${encodeURIComponent(appId)}`,
			{
				method: "PUT",
				headers,
				body: JSON.stringify({ spec }),
			},
		);

		return {
			written_count: context.items.length,
			target: { app_id: appId },
		};
	}

	private static async syncAzureKeyVault(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const tenantId = asString(context.connection.auth_config.tenant_id);
		const clientId = asString(context.connection.auth_config.client_id);
		const clientSecret = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "client_secret");
		if (!tenantId || !clientId || !clientSecret) {
			throw new ValidationError("Azure Key Vault connection requires tenant_id, client_id, and client_secret.", "ENTERPRISE_AZUREKV_AUTH_MISSING");
		}

		const vaultUrl = context.mapping.target_identifier.replace(/\/$/, "");
		const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "client_credentials",
				client_id: clientId,
				client_secret: clientSecret,
				scope: "https://vault.azure.net/.default",
			}),
		});
		const tokenBody = await tokenResponse.json().catch(() => null) as { access_token?: string } | null;
		if (!tokenResponse.ok || !tokenBody?.access_token) {
			throw new ValidationError("Failed to obtain Azure access token.", "ENTERPRISE_AZUREKV_AUTH_FAILED");
		}

		const headers = {
			Authorization: `Bearer ${tokenBody.access_token}`,
			"Content-Type": "application/json",
		};

		for (const item of context.items) {
			const name = this.buildRemoteKey(item, context).toLowerCase();
			await fetchJson(
				`${vaultUrl}/secrets/${encodeURIComponent(name)}?api-version=7.4`,
				{
					method: "PUT",
					headers,
					body: JSON.stringify({ value: item.value }),
				},
			);
		}

		return {
			written_count: context.items.length,
			target: { vault: vaultUrl },
		};
	}

	private static async syncAwsSecretsManager(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const accessKeyId = asString(context.connection.auth_config.access_key_id);
		const secretAccessKey = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "secret_access_key");
		const region = asString(context.connection.auth_config.region) ?? "us-east-1";
		if (!accessKeyId || !secretAccessKey) {
			throw new ValidationError("AWS Secrets Manager connection requires access_key_id and secret_access_key.", "ENTERPRISE_AWSSM_AUTH_MISSING");
		}

		const secretPath = context.mapping.target_identifier;
		const { SSMClient, PutParameterCommand } = await import("@aws-sdk/client-ssm");
		const client = new SSMClient({
			region,
			credentials: { accessKeyId, secretAccessKey },
		});

		for (const item of context.items) {
			const key = this.buildRemoteKey(item, context);
			const fullPath = secretPath ? `${secretPath.replace(/\/$/, "")}/${key}` : key;
			await client.send(new PutParameterCommand({
				Name: fullPath,
				Value: item.value,
				Type: item.kind === "secret" ? "SecureString" : "String",
				Overwrite: true,
			}));
		}

		return {
			written_count: context.items.length,
			target: { path: secretPath, region },
		};
	}

	private static async syncCloudflareWorkers(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "api_token");
		if (!token) {
			throw new ValidationError("Cloudflare Workers connection requires api_token or api_token_secret_ref.", "ENTERPRISE_CLOUDFLARE_AUTH_MISSING");
		}

		const accountId = asString(context.connection.auth_config.account_id);
		if (!accountId) {
			throw new ValidationError("Cloudflare Workers connection requires account_id.", "ENTERPRISE_CLOUDFLARE_ACCOUNT_MISSING");
		}

		const workerName = context.mapping.target_identifier;
		const headers = {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		};

		for (const item of context.items) {
			const key = this.buildRemoteKey(item, context);
			await fetchJson(
				`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/workers/services/${encodeURIComponent(workerName)}/secrets`,
				{
					method: "PUT",
					headers,
					body: JSON.stringify({ name: key, text: item.value, type: "secret_text" }),
				},
			);
		}

		return {
			written_count: context.items.length,
			target: { worker: workerName, account_id: accountId },
		};
	}

	private static async syncAzureAppService(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const tenantId = asString(context.connection.auth_config.tenant_id);
		const clientId = asString(context.connection.auth_config.client_id);
		const clientSecret = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "client_secret");
		if (!tenantId || !clientId || !clientSecret) {
			throw new ValidationError("Azure App Service requires tenant_id, client_id, and client_secret.", "ENTERPRISE_AZUREAPPSVC_AUTH_MISSING");
		}

		const appName = context.mapping.target_identifier;
		const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "client_credentials",
				client_id: clientId,
				client_secret: clientSecret,
				scope: "https://management.azure.com/.default",
			}),
		});
		const tokenBody = await tokenResponse.json().catch(() => null) as { access_token?: string } | null;
		if (!tokenResponse.ok || !tokenBody?.access_token) {
			throw new ValidationError("Failed to obtain Azure access token.", "ENTERPRISE_AZUREAPPSVC_AUTH_FAILED");
		}

		const headers = {
			Authorization: `Bearer ${tokenBody.access_token}`,
			"Content-Type": "application/json",
		};

		const appSettings: Record<string, string> = {};
		for (const item of context.items) {
			appSettings[this.buildRemoteKey(item, context)] = item.value;
		}

		await fetchJson(
			`https://management.azure.com/subscriptions/${encodeURIComponent(context.connection.auth_config.subscription_id ?? "")}/resourceGroups/${encodeURIComponent(context.connection.auth_config.resource_group ?? "")}/providers/Microsoft.Web/sites/${encodeURIComponent(appName)}/config/appsettings?api-version=2024-04-01`,
			{
				method: "PUT",
				headers,
				body: JSON.stringify({ properties: appSettings }),
			},
		);

		return {
			written_count: context.items.length,
			target: { app: appName },
		};
	}

	private static async syncCodefresh(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "api_token");
		if (!token) {
			throw new ValidationError("Codefresh requires api_token or api_token_secret_ref.", "ENTERPRISE_CODEFRESH_AUTH_MISSING");
		}

		const projectId = context.mapping.target_identifier;
		const headers = {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		};

		for (const item of context.items) {
			const key = this.buildRemoteKey(item, context);
			await fetchJson(
				`https://g.codefresh.io/api/projects/${encodeURIComponent(projectId)}/variables`,
				{
					method: "POST",
					headers,
					body: JSON.stringify({ key, value: item.value }),
				},
				[409],
			);
		}

		return {
			written_count: context.items.length,
			target: { project: projectId },
		};
	}

	private static async syncDenoDeploy(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "token");
		if (!token) {
			throw new ValidationError("Deno Deploy requires token or token_secret_ref.", "ENTERPRISE_DENO_AUTH_MISSING");
		}

		const projectId = context.mapping.target_identifier;
		const headers = {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		};

		const envVars: Record<string, string> = {};
		for (const item of context.items) {
			envVars[this.buildRemoteKey(item, context)] = item.value;
		}

		await fetchJson(
			`https://api.deno.com/v1/projects/${encodeURIComponent(projectId)}/env`,
			{
				method: "POST",
				headers,
				body: JSON.stringify({ envVars }),
			},
		);

		return {
			written_count: context.items.length,
			target: { project: projectId },
		};
	}

	private static async syncHarness(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const apiKey = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "api_key");
		if (!apiKey) {
			throw new ValidationError("Harness requires api_key or api_key_secret_ref.", "ENTERPRISE_HARNESS_AUTH_MISSING");
		}

		const connectorId = context.mapping.target_identifier;
		const headers = {
			"x-api-key": apiKey,
			"Content-Type": "application/json",
		};

		for (const item of context.items) {
			const key = this.buildRemoteKey(item, context);
			await fetchJson(
				`https://app.harness.io/gateway/ng/api/connectors/${encodeURIComponent(connectorId)}/secrets`,
				{
					method: "POST",
					headers,
					body: JSON.stringify({ key, value: item.value }),
				},
			);
		}

		return {
			written_count: context.items.length,
			target: { connector: connectorId },
		};
	}

	private static async syncHasuraCloud(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "api_token");
		if (!token) {
			throw new ValidationError("Hasura Cloud requires api_token or api_token_secret_ref.", "ENTERPRISE_HASURA_AUTH_MISSING");
		}

		const projectId = context.mapping.target_identifier;
		const headers = {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		};

		const envVars: Record<string, string> = {};
		for (const item of context.items) {
			envVars[this.buildRemoteKey(item, context)] = item.value;
		}

		await fetchJson(
			`https://api.hasura.cloud/v1/projects/${encodeURIComponent(projectId)}/env-vars`,
			{
				method: "POST",
				headers,
				body: JSON.stringify(envVars),
			},
		);

		return {
			written_count: context.items.length,
			target: { project: projectId },
		};
	}

	private static async syncHeroku(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const apiKey = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "api_key");
		if (!apiKey) {
			throw new ValidationError("Heroku requires api_key or api_key_secret_ref.", "ENTERPRISE_HEROKU_AUTH_MISSING");
		}

		const appName = context.mapping.target_identifier;
		const headers = {
			Authorization: `Bearer ${apiKey}`,
			Accept: "application/vnd.heroku+json; version=3",
			"Content-Type": "application/json",
		};

		const configVars: Record<string, string> = {};
		for (const item of context.items) {
			configVars[this.buildRemoteKey(item, context)] = item.value;
		}

		await fetchJson(
			`https://api.heroku.com/apps/${encodeURIComponent(appName)}/config-vars`,
			{
				method: "PATCH",
				headers,
				body: JSON.stringify(configVars),
			},
		);

		return {
			written_count: context.items.length,
			target: { app: appName },
		};
	}

	private static async syncLaravelForge(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "api_token");
		if (!token) {
			throw new ValidationError("Laravel Forge requires api_token or api_token_secret_ref.", "ENTERPRISE_FORGE_AUTH_MISSING");
		}

		const serverId = context.mapping.target_identifier;
		const headers = {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			Accept: "application/json",
		};

		for (const item of context.items) {
			const key = this.buildRemoteKey(item, context);
			await fetchJson(
				`https://forge.laravel.com/api/v1/servers/${encodeURIComponent(serverId)}/env`,
				{
					method: "POST",
					headers,
					body: JSON.stringify({ key, value: item.value }),
				},
			);
		}

		return {
			written_count: context.items.length,
			target: { server: serverId },
		};
	}

	private static async syncQovery(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "token");
		if (!token) {
			throw new ValidationError("Qovery requires token or token_secret_ref.", "ENTERPRISE_QOVERY_AUTH_MISSING");
		}

		const environmentId = context.mapping.target_identifier;
		const headers = {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		};

		for (const item of context.items) {
			const key = this.buildRemoteKey(item, context);
			await fetchJson(
				`https://api.qovery.com/environment/${encodeURIComponent(environmentId)}/environmentVariable`,
				{
					method: "POST",
					headers,
					body: JSON.stringify({ key, value: item.value, is_secret: item.kind === "secret" }),
				},
			);
		}

		return {
			written_count: context.items.length,
			target: { environment: environmentId },
		};
	}

	private static async syncTerraformCloud(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		const token = await this.resolveConfigValue(context.org_id, context.connection.auth_config, "token");
		if (!token) {
			throw new ValidationError("Terraform Cloud requires token or token_secret_ref.", "ENTERPRISE_TFC_AUTH_MISSING");
		}

		const workspaceId = context.mapping.target_identifier;
		const headers = {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/vnd.api+json",
		};

		for (const item of context.items) {
			const key = this.buildRemoteKey(item, context);
			await fetchJson(
				`https://app.terraform.io/api/v2/workspaces/${encodeURIComponent(workspaceId)}/vars`,
				{
					method: "POST",
					headers,
					body: JSON.stringify({
						data: {
							type: "vars",
							attributes: {
								key,
								value: item.value,
								category: "env",
								sensitive: item.kind === "secret",
							},
						},
					}),
				},
				[422],
			);
		}

		return {
			written_count: context.items.length,
			target: { workspace: workspaceId },
		};
	}

	public static async sync(context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> {
		switch (context.provider_type) {
			case "github":
				return this.syncGithub(context);
			case "gitlab":
				return this.syncGitlab(context);
			case "vercel":
				return this.syncVercel(context);
			case "aws-ssm":
				return this.syncAwsSsm(context);
			case "google-secret-manager":
				return this.syncGoogleSecretManager(context);
			case "circleci":
				return this.syncCircleCI(context);
			case "jenkins":
				return this.syncJenkins(context);
			case "azure-devops":
				return this.syncAzureDevOps(context);
			case "bitbucket":
				return this.syncBitbucket(context);
			case "travisci":
				return this.syncTravisCI(context);
			case "netlify":
				return this.syncNetlify(context);
			case "railway":
				return this.syncRailway(context);
			case "fly-io":
				return this.syncFlyio(context);
			case "render":
				return this.syncRender(context);
			case "supabase":
				return this.syncSupabase(context);
			case "digitalocean-app-platform":
				return this.syncDigitalOcean(context);
			case "azure-key-vault":
				return this.syncAzureKeyVault(context);
			case "aws-secrets-manager":
				return this.syncAwsSecretsManager(context);
			case "cloudflare-workers":
				return this.syncCloudflareWorkers(context);
			case "azure-app-service":
				return this.syncAzureAppService(context);
			case "codefresh":
				return this.syncCodefresh(context);
			case "deno-deploy":
				return this.syncDenoDeploy(context);
			case "harness":
				return this.syncHarness(context);
			case "hasura-cloud":
				return this.syncHasuraCloud(context);
			case "heroku":
				return this.syncHeroku(context);
			case "laravel-forge":
				return this.syncLaravelForge(context);
			case "qovery":
				return this.syncQovery(context);
			case "terraform-cloud":
				return this.syncTerraformCloud(context);
			default:
				throw new ValidationError(`Unsupported provider type: ${context.provider_type}`, "ENTERPRISE_PROVIDER_UNSUPPORTED");
		}
	}
}
