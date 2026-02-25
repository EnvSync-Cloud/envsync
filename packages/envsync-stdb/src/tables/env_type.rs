use spacetimedb::{table, Timestamp};

/// Environment type — replaces PostgreSQL `env_type` table.
#[table(public, accessor = env_type)]
pub struct EnvType {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// UUID string used as external identifier
    pub uuid: String,
    #[index(btree)]
    pub org_id: String,
    pub name: String,
    #[index(btree)]
    pub app_id: String,
    pub is_default: bool,
    pub is_protected: bool,
    pub color: String,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}
