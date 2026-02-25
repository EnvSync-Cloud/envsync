use spacetimedb::{table, Timestamp};

/// Team member — replaces PostgreSQL `team_members` table.
#[table(public, accessor = team_member)]
pub struct TeamMember {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// UUID string used as external identifier
    pub uuid: String,
    #[index(btree)]
    pub team_id: String,
    #[index(btree)]
    pub user_id: String,
    pub created_at: Timestamp,
}
