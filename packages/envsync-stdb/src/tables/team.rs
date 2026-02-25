use spacetimedb::{table, Timestamp};

/// Team — replaces PostgreSQL `teams` table.
#[table(public, accessor = team)]
pub struct Team {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// UUID string used as external identifier
    pub uuid: String,
    #[index(btree)]
    pub org_id: String,
    pub name: String,
    pub description: String,
    pub color: String,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}
