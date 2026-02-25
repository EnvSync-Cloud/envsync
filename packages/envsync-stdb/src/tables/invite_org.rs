use spacetimedb::{table, Timestamp};

/// Organization invitation — replaces PostgreSQL `invite_org` table.
#[table(public, accessor = invite_org)]
pub struct InviteOrg {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// UUID string used as external identifier
    pub uuid: String,
    pub email: String,
    #[unique]
    pub invite_token: String,
    pub is_accepted: bool,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}
