use spacetimedb::{table, Timestamp};

/// Environment store point-in-time snapshot — replaces PostgreSQL
/// `env_store_pit` + `env_store_pit_change_request` tables.
#[table(public, accessor = env_store_pit)]
pub struct EnvStorePit {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// UUID string used as external identifier
    pub uuid: String,
    #[index(btree)]
    pub org_id: String,
    pub env_type_id: String,
    pub user_id: String,
    pub app_id: String,
    pub change_request_message: String,
    /// JSON array of change requests: [{ key, value, operation }]
    pub changes: String,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}
