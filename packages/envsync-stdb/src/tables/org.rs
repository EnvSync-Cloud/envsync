use spacetimedb::{table, Timestamp};

/// Organization — replaces PostgreSQL `orgs` table.
#[table(public, accessor = org)]
pub struct Org {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// UUID string used as external identifier
    pub uuid: String,
    pub name: String,
    pub logo_url: String,
    #[unique]
    pub slug: String,
    pub size: String,
    pub website: String,
    /// JSON-serialized metadata
    pub metadata: String,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}
