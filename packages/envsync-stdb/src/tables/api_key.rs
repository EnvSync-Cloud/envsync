use spacetimedb::{table, Timestamp};

/// API key — replaces PostgreSQL `api_keys` table.
#[table(public, accessor = api_key)]
pub struct ApiKey {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// UUID string used as external identifier
    pub uuid: String,
    #[index(btree)]
    pub org_id: String,
    pub user_id: String,
    #[unique]
    pub key: String,
    pub description: String,
    pub is_active: bool,
    pub last_used_at: String,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}
