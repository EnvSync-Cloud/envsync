use spacetimedb::{table, Timestamp};

/// User invitation — replaces PostgreSQL `invite_user` table.
#[table(public, accessor = invite_user)]
pub struct InviteUser {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// UUID string used as external identifier
    pub uuid: String,
    #[unique]
    pub email: String,
    pub role_id: String,
    pub invite_token: String,
    pub is_accepted: bool,
    #[index(btree)]
    pub org_id: String,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}
