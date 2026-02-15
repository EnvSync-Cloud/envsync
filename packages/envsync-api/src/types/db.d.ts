import type { ColumnType } from "kysely";

interface BaseTable {
	id: ColumnType<string>;
	created_at: ColumnType<Date>;
	updated_at: ColumnType<Date>;
}

interface InviteOrg extends BaseTable {
	email: ColumnType<string>;
	invite_token: ColumnType<string>;
	is_accepted: ColumnType<boolean>;
}

interface InviteUser extends BaseTable {
	email: ColumnType<string>;
	role_id: ColumnType<string>;
	invite_token: ColumnType<string>;
	is_accepted: ColumnType<boolean>;
	org_id: ColumnType<string>;
}

interface OrgRole extends BaseTable {
	org_id: ColumnType<string>;
	name: ColumnType<string>;
	is_admin: ColumnType<boolean>;
	can_view: ColumnType<boolean>;
	can_edit: ColumnType<boolean>;
	have_billing_options: ColumnType<boolean>;
	have_api_access: ColumnType<boolean>;
	have_webhook_access: ColumnType<boolean>;
	color: ColumnType<string>;
	is_master?: ColumnType<boolean>;
}

interface EnvStore extends BaseTable {
	org_id: ColumnType<string>;
	env_type_id: ColumnType<string>;
	app_id: ColumnType<string>;
	key: ColumnType<string>;
	value: ColumnType<string>;
}

interface EnvStorePiT extends BaseTable {
	change_request_message: ColumnType<string>;
	org_id: ColumnType<string>;
	env_type_id: ColumnType<string>;
	user_id: ColumnType<string>;
	app_id: ColumnType<string>;
}

interface EnvStorePiTChangeRequest extends BaseTable {
	env_store_pit_id: ColumnType<string>;
	key: ColumnType<string>;
	value: ColumnType<string>;
	operation: ColumnType<"CREATE" | "UPDATE" | "DELETE">;
}

interface SecretStore extends BaseTable {
	org_id: ColumnType<string>;
	env_type_id: ColumnType<string>;
	app_id: ColumnType<string>;
	key: ColumnType<string>;
	value: ColumnType<string>;
}

interface SecretStorePiT extends BaseTable {
	change_request_message: ColumnType<string>;
	org_id: ColumnType<string>;
	env_type_id: ColumnType<string>;
	user_id: ColumnType<string>;
	app_id: ColumnType<string>;
}

interface SecretStorePiTChangeRequest extends BaseTable {
	secret_store_pit_id: ColumnType<string>;
	key: ColumnType<string>;
	value: ColumnType<string>;
	operation: ColumnType<"CREATE" | "UPDATE" | "DELETE">;
}

interface AuditLog extends BaseTable {
	org_id: ColumnType<string>;
	user_id: ColumnType<string>;
	action: ColumnType<AuditActions | string>;
	details: ColumnType<string>;
	message: ColumnType<string>;
}

interface App extends BaseTable {
	name: ColumnType<string>;
	org_id: ColumnType<string>;
	description: ColumnType<string>;
	enable_secrets: ColumnType<boolean>;
	is_managed_secret: ColumnType<boolean>;
	public_key?: ColumnType<string | null>;
	private_key?: ColumnType<string | null>;
	metadata: ColumnType<Record<string, any>>;
}

interface EnvType extends BaseTable {
	org_id: ColumnType<string>;
	name: ColumnType<string>;
	app_id: ColumnType<string>;
	is_default: ColumnType<boolean>;
	is_protected: ColumnType<boolean>;
	color: ColumnType<string>;
}

interface Users extends BaseTable {
	email: ColumnType<string>;
	org_id: ColumnType<string>;
	role_id: ColumnType<string>;
	auth_service_id?: ColumnType<string | null>;
	full_name?: ColumnType<string | null>;
	profile_picture_url?: ColumnType<string | null>;
	last_login?: ColumnType<Date | null>;
	is_active: ColumnType<boolean>;
}

interface Orgs extends BaseTable {
	name: ColumnType<string>;
	logo_url?: ColumnType<string | null>;
	slug: ColumnType<string>;
	size?: ColumnType<string | null>;
	website?: ColumnType<string | null>;
	metadata: ColumnType<Record<string, any>>;
}

interface Settings extends BaseTable {
	user_id: ColumnType<string>;
	email_notifications: ColumnType<boolean>;
	theme?: ColumnType<string | null>;
}

interface ApiKeys extends BaseTable {
	org_id: ColumnType<string>;
	user_id: ColumnType<string>;
	key: ColumnType<string>;
	description?: ColumnType<string | null>;
	is_active: ColumnType<boolean>;
	last_used_at?: ColumnType<Date | null>;
}

interface WebhookStore extends BaseTable {
	name: ColumnType<string>;
	org_id: ColumnType<string>;
	user_id: ColumnType<string>;
	url: ColumnType<string>;
	event_types: ColumnType<string[]>;
	is_active: ColumnType<boolean>;
	webhook_type: ColumnType<"CUSTOM" | "DISCORD" | "SLACK">
	app_id?: ColumnType<string | null>;
	linked_to: ColumnType<"org" | "app">;
	last_triggered_at?: ColumnType<Date | null>;
}

export interface Database {
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
}
