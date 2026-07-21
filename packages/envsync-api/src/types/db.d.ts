import type { ColumnType, JsonValue } from "kysely";

export interface BaseTable {
	id: ColumnType<string>;
	created_at: ColumnType<Date>;
	updated_at: ColumnType<Date>;
}

export interface InviteOrg extends BaseTable {
	email: ColumnType<string>;
	invite_token: ColumnType<string>;
	is_accepted: ColumnType<boolean>;
}

export interface InviteUser extends BaseTable {
	email: ColumnType<string>;
	role_id: ColumnType<string>;
	invite_token: ColumnType<string>;
	is_accepted: ColumnType<boolean>;
	org_id: ColumnType<string>;
}

export interface OrgRole extends BaseTable {
	org_id: ColumnType<string>;
	name: ColumnType<string>;
	is_admin: ColumnType<boolean>;
	can_view: ColumnType<boolean>;
	can_edit: ColumnType<boolean>;
	have_billing_options: ColumnType<boolean>;
	have_api_access: ColumnType<boolean>;
	have_webhook_access: ColumnType<boolean>;
	have_gpg_access: ColumnType<boolean>;
	have_cert_access: ColumnType<boolean>;
	have_audit_access: ColumnType<boolean>;
	color: ColumnType<string>;
	is_master?: ColumnType<boolean>;
}

export interface EnvStore extends BaseTable {
	org_id: ColumnType<string>;
	env_type_id: ColumnType<string>;
	app_id: ColumnType<string>;
	key: ColumnType<string>;
	value: ColumnType<string>;
}

export interface EnvStorePiT extends BaseTable {
	change_request_message: ColumnType<string>;
	org_id: ColumnType<string>;
	env_type_id: ColumnType<string>;
	user_id: ColumnType<string>;
	app_id: ColumnType<string>;
}

export interface EnvStorePiTChangeRequest extends BaseTable {
	env_store_pit_id: ColumnType<string>;
	key: ColumnType<string>;
	value: ColumnType<string>;
	operation: ColumnType<"CREATE" | "UPDATE" | "DELETE">;
}

export interface SecretStore extends BaseTable {
	org_id: ColumnType<string>;
	env_type_id: ColumnType<string>;
	app_id: ColumnType<string>;
	key: ColumnType<string>;
	value: ColumnType<string>;
}

export interface SecretStorePiT extends BaseTable {
	change_request_message: ColumnType<string>;
	org_id: ColumnType<string>;
	env_type_id: ColumnType<string>;
	user_id: ColumnType<string>;
	app_id: ColumnType<string>;
}

export interface SecretStorePiTChangeRequest extends BaseTable {
	secret_store_pit_id: ColumnType<string>;
	key: ColumnType<string>;
	value: ColumnType<string>;
	operation: ColumnType<"CREATE" | "UPDATE" | "DELETE">;
}

export interface AuditLog extends BaseTable {
	org_id: ColumnType<string>;
	user_id: ColumnType<string>;
	action: ColumnType<AuditActions | string>;
	details: ColumnType<string>;
	message: ColumnType<string>;
	previous_hash?: ColumnType<string | null>;
	entry_hash?: ColumnType<string | null>;
}

export interface App extends BaseTable {
	name: ColumnType<string>;
	org_id: ColumnType<string>;
	description: ColumnType<string>;
	enable_secrets: ColumnType<boolean>;
	is_managed_secret: ColumnType<boolean>;
	public_key?: ColumnType<string | null>;
	private_key?: ColumnType<string | null>;
	metadata: ColumnType<Record<string, any>>;
	kms_key_version_id?: ColumnType<string | null>;
	encryption_migrated?: ColumnType<boolean>;
}

export interface EnvType extends BaseTable {
	org_id: ColumnType<string>;
	name: ColumnType<string>;
	app_id: ColumnType<string>;
	is_default: ColumnType<boolean>;
	is_protected: ColumnType<boolean>;
	color: ColumnType<string>;
}

export interface Users extends BaseTable {
	email: ColumnType<string>;
	org_id: ColumnType<string>;
	role_id: ColumnType<string>;
	auth_service_id?: ColumnType<string | null>;
	full_name?: ColumnType<string | null>;
	profile_picture_url?: ColumnType<string | null>;
	last_login?: ColumnType<Date | null>;
	is_active: ColumnType<boolean>;
}

export interface Orgs extends BaseTable {
	name: ColumnType<string>;
	logo_url?: ColumnType<string | null>;
	slug: ColumnType<string>;
	size?: ColumnType<string | null>;
	website?: ColumnType<string | null>;
	metadata: ColumnType<Record<string, any>>;
}

export interface Settings extends BaseTable {
	user_id: ColumnType<string>;
	email_notifications: ColumnType<boolean>;
	theme?: ColumnType<string | null>;
}

export interface ApiKeys extends BaseTable {
	org_id: ColumnType<string>;
	user_id: ColumnType<string>;
	key: ColumnType<string>;
	description?: ColumnType<string | null>;
	is_active: ColumnType<boolean>;
	last_used_at?: ColumnType<Date | null>;
}

export interface WebhookStore extends BaseTable {
	name: ColumnType<string>;
	org_id: ColumnType<string>;
	user_id: ColumnType<string>;
	url: ColumnType<string>;
	event_types: ColumnType<string[]>;
	is_active: ColumnType<boolean>;
	webhook_type: ColumnType<"CUSTOM" | "DISCORD" | "SLACK" | "GITHUB_ACTIONS" | "GITLAB_PIPELINE" | "AWS_CODEPIPELINE" | "GCP_CLOUD_BUILD" | "CIRCLECI" | "TRAVIS_CI" | "JENKINS">
	app_id?: ColumnType<string | null>;
	linked_to: ColumnType<"org" | "app">;
	last_triggered_at?: ColumnType<Date | null>;
}

export interface Team extends BaseTable {
	org_id: ColumnType<string>;
	name: ColumnType<string>;
	description?: ColumnType<string | null>;
	color: ColumnType<string>;
	role_id?: ColumnType<string | null>;
}

export interface TeamMember {
	id: ColumnType<string>;
	team_id: ColumnType<string>;
	user_id: ColumnType<string>;
	created_at: ColumnType<Date>;
}

export interface GpgKey extends BaseTable {
	org_id: ColumnType<string>;
	user_id: ColumnType<string>;
	name: ColumnType<string>;
	email: ColumnType<string>;
	fingerprint: ColumnType<string>;
	key_id: ColumnType<string>;
	algorithm: ColumnType<string>;
	key_size?: ColumnType<number | null>;
	public_key: ColumnType<string>;
	private_key_ref: ColumnType<string>;
	usage_flags: ColumnType<string[]>;
	trust_level: ColumnType<string>;
	expires_at?: ColumnType<Date | null>;
	revoked_at?: ColumnType<Date | null>;
	revocation_reason?: ColumnType<string | null>;
	is_default: ColumnType<boolean>;
	status: ColumnType<string>;
	supersedes_gpg_key_id?: ColumnType<string | null>;
}

export interface OrgCertificate extends BaseTable {
	org_id: ColumnType<string>;
	user_id: ColumnType<string>;
	serial_hex: ColumnType<string>;
	cert_type: ColumnType<string>;
	subject_cn: ColumnType<string>;
	subject_email?: ColumnType<string | null>;
	status: ColumnType<string>;
	cert_pem?: ColumnType<string | null>;
	not_before?: ColumnType<Date | null>;
	not_after?: ColumnType<Date | null>;
	description?: ColumnType<string | null>;
	metadata?: ColumnType<Record<string, string> | null>;
	revoked_at?: ColumnType<Date | null>;
	revocation_reason?: ColumnType<number | null>;
	supersedes_certificate_id?: ColumnType<string | null>;
	is_system_generated: ColumnType<boolean>;
	encrypted_key_pem?: ColumnType<string | null>;
}

export interface ChangeRequest extends BaseTable {
	org_id: ColumnType<string>;
	app_id: ColumnType<string>;
	request_kind: ColumnType<"direct" | "promotion">;
	source_env_type_id?: ColumnType<string | null>;
	target_env_type_id: ColumnType<string>;
	status: ColumnType<"pending" | "approved" | "rejected" | "cancelled">;
	title: ColumnType<string>;
	message: ColumnType<string>;
	requested_by_user_id: ColumnType<string>;
	reviewed_by_user_id?: ColumnType<string | null>;
	reviewed_at?: ColumnType<Date | null>;
	applied_at?: ColumnType<Date | null>;
	rejection_reason?: ColumnType<string | null>;
}

export interface ChangeRequestEnvItem extends BaseTable {
	change_request_id: ColumnType<string>;
	key: ColumnType<string>;
	previous_value?: ColumnType<string | null>;
	proposed_value?: ColumnType<string | null>;
	operation: ColumnType<"CREATE" | "UPDATE" | "DELETE">;
}

export interface ChangeRequestSecretItem extends BaseTable {
	change_request_id: ColumnType<string>;
	key: ColumnType<string>;
	previous_value?: ColumnType<string | null>;
	proposed_value?: ColumnType<string | null>;
	operation: ColumnType<"CREATE" | "UPDATE" | "DELETE">;
}

export interface InstallState extends BaseTable {
	edition: ColumnType<"oss" | "enterprise">;
	first_bootstrap_completed_at?: ColumnType<Date | null>;
	single_org_mode: ColumnType<boolean>;
	management_enabled: ColumnType<boolean>;
	observability_enabled: ColumnType<boolean>;
	management_web_enabled: ColumnType<boolean>;
	landing_enabled: ColumnType<boolean>;
}

export interface LicenseState extends BaseTable {
	status: ColumnType<"unknown" | "active" | "inactive" | "expired" | "error" | "locked">;
	signed_lease?: ColumnType<string | null>;
	lease_expires_at?: ColumnType<Date | null>;
	fingerprint?: ColumnType<string | null>;
	last_verified_at?: ColumnType<Date | null>;
	last_error_code?: ColumnType<string | null>;
	last_error_message?: ColumnType<string | null>;
	validation_mode?: ColumnType<"none" | "lease" | "certificate" | null>;
	certificate_serial_hex?: ColumnType<string | null>;
	certificate_fingerprint_sha256?: ColumnType<string | null>;
	certificate_subject?: ColumnType<string | null>;
	certificate_issuer?: ColumnType<string | null>;
	certificate_expires_at?: ColumnType<Date | null>;
	root_ca_fingerprint_sha256?: ColumnType<string | null>;
	validated_at?: ColumnType<Date | null>;
}

export interface ProviderConnection extends BaseTable {
	org_id: ColumnType<string>;
	provider_type: ColumnType<"github" | "gitlab" | "aws-ssm" | "vercel" | "google-secret-manager">;
	name: ColumnType<string>;
	status: ColumnType<"active" | "inactive" | "error">;
	auth_config: ColumnType<Record<string, unknown>>;
	metadata: ColumnType<Record<string, unknown>>;
}

export interface OrgSecret extends BaseTable {
	org_id: ColumnType<string>;
	key: ColumnType<string>;
	value: ColumnType<string>;
	description?: ColumnType<string | null>;
	metadata: ColumnType<Record<string, unknown>>;
}

export interface IntegrationBinding extends BaseTable {
	org_id: ColumnType<string>;
	app_id: ColumnType<string>;
	provider_connection_id: ColumnType<string>;
	provider_type: ColumnType<"github" | "gitlab" | "aws-ssm" | "vercel" | "google-secret-manager">;
	is_enabled: ColumnType<boolean>;
	metadata: ColumnType<Record<string, unknown>>;
}

export interface EnvTypeMapping extends BaseTable {
	org_id: ColumnType<string>;
	app_id: ColumnType<string>;
	env_type_id: ColumnType<string>;
	integration_binding_id: ColumnType<string>;
	target_identifier: ColumnType<string>;
	branch_ref?: ColumnType<string | null>;
	path_prefix?: ColumnType<string | null>;
	metadata: ColumnType<Record<string, unknown>>;
}

export interface SyncRun extends BaseTable {
	org_id: ColumnType<string>;
	app_id?: ColumnType<string | null>;
	provider_type: ColumnType<"github" | "gitlab" | "aws-ssm" | "vercel" | "google-secret-manager">;
	status: ColumnType<"pending" | "running" | "succeeded" | "failed">;
	actor_user_id?: ColumnType<string | null>;
	started_at: ColumnType<Date>;
	completed_at?: ColumnType<Date | null>;
	error_message?: ColumnType<string | null>;
	metadata: ColumnType<Record<string, unknown>>;
}

export interface SyncAuditEvent extends BaseTable {
	org_id: ColumnType<string>;
	sync_run_id?: ColumnType<string | null>;
	app_id?: ColumnType<string | null>;
	env_type_id?: ColumnType<string | null>;
	provider_type: ColumnType<"github" | "gitlab" | "aws-ssm" | "vercel" | "google-secret-manager">;
	action: ColumnType<string>;
	result: ColumnType<"info" | "success" | "error">;
	actor_user_id?: ColumnType<string | null>;
	details: ColumnType<Record<string, unknown>>;
}

export interface ServiceToken extends BaseTable {
	org_id: ColumnType<string>;
	created_by_user_id: ColumnType<string>;
	name: ColumnType<string>;
	token_hash: ColumnType<string>;
	app_id?: ColumnType<string | null>;
	env_type_id?: ColumnType<string | null>;
	permissions: ColumnType<Record<string, boolean>>;
	expires_at: ColumnType<Date>;
	last_used_at?: ColumnType<Date | null>;
}

export interface OidcProvider extends BaseTable {
	org_id: ColumnType<string>;
	provider_type: ColumnType<"github_actions" | "gitlab_ci" | "kubernetes" | "generic">;
	issuer_url: ColumnType<string>;
	audience: ColumnType<string>;
	enabled: ColumnType<boolean>;
	allowed_subjects: ColumnType<JsonValue>;
	machine_user_id?: ColumnType<string | null>;
}

export interface SamlProvider extends BaseTable {
	org_id: ColumnType<string>;
	provider_type: ColumnType<"okta" | "onelogin" | "azure-ad" | "google-workspace" | "duo" | "rippling" | "oracle" | "ping-identity">;
	name: ColumnType<string>;
	entity_id: ColumnType<string>;
	sso_url: ColumnType<string>;
	certificate: ColumnType<string>;
	enabled: ColumnType<boolean>;
}

export interface RotationPolicy extends BaseTable {
	org_id: ColumnType<string>;
	app_id: ColumnType<string>;
	env_type_id: ColumnType<string>;
	variable_key: ColumnType<string>;
	engine_type: ColumnType<"postgres" | "mysql" | "aws-iam" | "azure-sp" | "gcp-service-account" | "cloudflare-pages" | "sendgrid" | "twilio">;
	schedule_cron: ColumnType<string>;
	dual_window_minutes: ColumnType<number>;
	enabled: ColumnType<boolean>;
	last_rotated_at?: ColumnType<Date | null>;
	next_rotation_at?: ColumnType<Date | null>;
}

export interface RotationState extends BaseTable {
	rotation_policy_id: ColumnType<string>;
	old_credential_encrypted?: ColumnType<string | null>;
	new_credential_encrypted: ColumnType<string>;
	rotated_at: ColumnType<Date>;
	old_credential_expires_at: ColumnType<Date>;
	old_credential_revoked: ColumnType<boolean>;
	revoked_at?: ColumnType<Date | null>;
}

export interface DynamicSecretEngine extends BaseTable {
	org_id: ColumnType<string>;
	engine_type: ColumnType<"postgres" | "mysql" | "aws-iam" | "azure-sp">;
	name: ColumnType<string>;
	config: ColumnType<Record<string, unknown>>;
	enabled: ColumnType<boolean>;
}

export interface DynamicSecretLease extends BaseTable {
	engine_id: ColumnType<string>;
	app_id: ColumnType<string>;
	env_type_id: ColumnType<string>;
	variable_key: ColumnType<string>;
	credential_data: ColumnType<Record<string, unknown>>;
	expires_at: ColumnType<Date>;
	revoked_at?: ColumnType<Date | null>;
}

export interface LogForwardingConfig extends BaseTable {
	org_id: ColumnType<string>;
	provider_type: ColumnType<"datadog" | "splunk" | "sumo-logic">;
	name: ColumnType<string>;
	config: ColumnType<Record<string, unknown>>;
	enabled: ColumnType<boolean>;
}

export interface BaseDatabase {
	invite_org: InviteOrg;
	invite_user: InviteUser;
	org_role: OrgRole;
	audit_log: AuditLog;
	app: App;
	env_type: EnvType;
	users: Users;
	orgs: Orgs;
	settings: Settings;
	api_keys: ApiKeys;
	env_store_pit: EnvStorePiT;
	env_store_pit_change_request: EnvStorePiTChangeRequest;
	secret_store_pit: SecretStorePiT;
	secret_store_pit_change_request: SecretStorePiTChangeRequest;
	webhook_store: WebhookStore;
	teams: Team;
	team_members: TeamMember;
	gpg_keys: GpgKey;
	org_certificates: OrgCertificate;
	change_request: ChangeRequest;
	change_request_env_item: ChangeRequestEnvItem;
	change_request_secret_item: ChangeRequestSecretItem;
	install_state: InstallState;
	license_state: LicenseState;
	provider_connection: ProviderConnection;
	org_secret: OrgSecret;
	integration_binding: IntegrationBinding;
	env_type_mapping: EnvTypeMapping;
	sync_run: SyncRun;
	sync_audit_event: SyncAuditEvent;
	service_tokens: ServiceToken;
	oidc_providers: OidcProvider;
	saml_providers: SamlProvider;
	dynamic_secret_engines: DynamicSecretEngine;
	dynamic_secret_leases: DynamicSecretLease;
	rotation_policies: RotationPolicy;
	rotation_state: RotationState;
	log_forwarding_configs: LogForwardingConfig;
}

/**
 * Private superset repos can augment this interface using declaration merging
 * to add enterprise-only tables without editing the public schema contract.
 */
export interface DatabaseExtensions {}

export interface Database extends BaseDatabase, DatabaseExtensions {}
