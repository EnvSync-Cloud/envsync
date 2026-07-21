type AppAuditActions = 
	| "app_created"
	| "app_updated"
	| "app_deleted"
	| "app_viewed"
	| "apps_viewed";

type AuditLogAuditActions = "get_audit_logs";

type EnvAuditActions = 
	| "env_type_created"
	| "env_type_updated"
	| "env_type_deleted"
	| "env_types_viewed"
	| "env_type_viewed";

type EnvStoreAuditActions =
	| "env_created"
	| "env_updated"
	| "env_deleted"
	| "env_viewed"
	| "envs_viewed"
	| "envs_batch_created"
	| "envs_batch_updated"
	| "envs_batch_deleted"
	| "envs_rollback_pit"
	| "envs_rollback_timestamp"
	| "env_variable_rollback_pit"
	| "env_variable_rollback_timestamp"
	| "env_variable_timeline_viewed"
	| "env_variable_diff_viewed"
	| "env_variable_history_viewed"
	| "envs_pit_viewed"
	| "envs_timestamp_viewed";

type SecretStoreAuditActions =
	| "secret_created"
	| "secret_updated"
	| "secret_deleted"
	| "secret_viewed"
	| "secrets_viewed"
	| "secrets_batch_created"
	| "secrets_batch_updated"
	| "secrets_batch_deleted"
	| "secrets_rollback_pit"
	| "secrets_rollback_timestamp"
	| "secret_variable_rollback_pit"
	| "secret_variable_rollback_timestamp"
	| "secret_history_viewed"
	| "secret_variable_history_viewed"
	| "secrets_pit_viewed"
	| "secrets_timestamp_viewed"
	| "secret_diff_viewed"
	| "secret_timeline_viewed";

type OnboardingAuditActions =
	| "org_created"
	| "user_invite_created"
	| "user_invite_accepted"
	| "user_invite_viewed"
	| "user_invite_updated"
	| "user_invite_deleted"
	| "user_invites_retrieved";

type OrgAuditActions =
	| "org_updated"
	| "org_deleted";

type RoleAuditActions =
	| "roles_viewed"
	| "role_viewed"
	| "role_created"
	| "role_updated"
	| "role_deleted";

type UserAuditActions =
	| "users_retrieved"
	| "user_retrieved"
	| "user_updated"
	| "user_deleted"
	| "user_role_updated"
	| "password_update_requested";

type ApiKeyAuditActions =
	| "apikeys_viewed"
	| "apikey_viewed"
	| "apikey_created"
	| "apikey_deleted"
	| "apikey_updated"
	| "apikey_regenerated";

type WebHookAuditActions =
	| "webhook_created"
	| "webhook_updated"
	| "webhook_deleted"
	| "webhook_viewed"
	| "webhooks_viewed"
	| "webhook_triggered";

type TeamAuditActions =
	| "team_created"
	| "team_updated"
	| "team_deleted"
	| "team_viewed"
	| "teams_viewed"
	| "team_member_added"
	| "team_member_removed"
	| "team_role_assigned"
	| "team_role_unassigned";

type PermissionAuditActions =
	| "permission_granted"
	| "permission_revoked"
	| "permissions_viewed"
	| "app_access_granted"
	| "app_access_revoked";

type ChangeRequestAuditActions =
	| "change_request_created"
	| "change_request_approved"
	| "change_request_rejected"
	| "change_request_cancelled"
	| "promotion_request_created"
	| "promotion_request_applied";

type GpgKeyAuditActions =
	| "gpg_key_generated"
	| "gpg_key_imported"
	| "gpg_key_viewed"
	| "gpg_key_exported"
	| "gpg_key_deleted"
	| "gpg_key_revoked"
	| "gpg_key_trust_updated"
	| "gpg_data_signed"
	| "gpg_signature_verified"
	| "gpg_key_rotated"
	| "gpg_key_expiry_extended";

type CertificateAuditActions =
	| "cert_ca_initialized"
	| "cert_member_issued"
	| "certs_viewed"
	| "cert_viewed"
	| "cert_bundle_retrieved"
	| "cert_revoked"
	| "certificate_renewed"
	| "certificate_rotated";

type CliAuditActions = "cli_command_executed";

type ServiceTokenAuditActions =
	| "service_token_created"
	| "service_token_deleted"
	| "service_tokens_viewed";

type OidcAuditActions =
	| "oidc_provider_created"
	| "oidc_provider_updated"
	| "oidc_provider_deleted";

type SamlAuditActions =
	| "saml_provider_created"
	| "saml_provider_updated"
	| "saml_provider_deleted"
	| "saml_sso_success";

type RotationAuditActions =
	| "rotation_policy_created"
	| "rotation_policy_updated"
	| "rotation_policy_deleted"
	| "rotation_triggered"
	| "rotation_expired_credentials_revoked";

type DynamicSecretAuditActions =
	| "dynamic_secret_engine_created"
	| "dynamic_secret_engine_updated"
	| "dynamic_secret_engine_deleted"
	| "dynamic_secret_lease_created"
	| "dynamic_secret_lease_revoked";

type EnterpriseAuditActions =
	| "enterprise_provider_connection_created"
	| "enterprise_provider_connection_updated"
	| "enterprise_org_secret_created"
	| "enterprise_org_secret_updated"
	| "enterprise_integration_binding_created"
	| "enterprise_integration_binding_updated"
	| "enterprise_env_mapping_created"
	| "enterprise_env_mapping_updated"
	| "enterprise_sync_run_created";

type AuditActions =
	| AppAuditActions
	| AuditLogAuditActions
	| ApiKeyAuditActions
	| EnvAuditActions
	| EnvStoreAuditActions
	| OnboardingAuditActions
	| RoleAuditActions
	| OrgAuditActions
	| SecretStoreAuditActions
	| UserAuditActions
	| WebHookAuditActions
	| TeamAuditActions
	| PermissionAuditActions
	| ChangeRequestAuditActions
	| GpgKeyAuditActions
	| CertificateAuditActions
	| CliAuditActions
	| EnterpriseAuditActions
	| ServiceTokenAuditActions
	| OidcAuditActions
	| SamlAuditActions
	| RotationAuditActions
	| DynamicSecretAuditActions;
