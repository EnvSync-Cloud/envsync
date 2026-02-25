use spacetimedb::{table, Timestamp};

/// Application — replaces PostgreSQL `app` table.
#[table(public, accessor = app)]
pub struct App {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// UUID string used as external identifier
    pub uuid: String,
    pub name: String,
    #[index(btree)]
    pub org_id: String,
    pub description: String,
    pub enable_secrets: bool,
    pub is_managed_secret: bool,
    pub public_key: String,
    pub private_key: String,
    /// JSON-serialized metadata
    pub metadata: String,
    pub kms_key_version_id: String,
    pub encryption_migrated: bool,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}
