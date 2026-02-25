use spacetimedb::{table, Timestamp};

/// Organization role — replaces PostgreSQL `org_role` table.
#[table(public, accessor = org_role)]
pub struct OrgRole {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// UUID string used as external identifier
    pub uuid: String,
    #[index(btree)]
    pub org_id: String,
    pub name: String,
    pub is_admin: bool,
    pub is_master: bool,
    pub can_view: bool,
    pub can_edit: bool,
    pub have_billing_options: bool,
    pub have_api_access: bool,
    pub have_webhook_access: bool,
    pub have_gpg_access: bool,
    pub have_cert_access: bool,
    pub have_audit_access: bool,
    pub color: String,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}
