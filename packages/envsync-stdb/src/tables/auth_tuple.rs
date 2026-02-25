use spacetimedb::{table, Timestamp};

/// Authorization tuple — replaces OpenFGA tuples.
/// Stores relationship tuples for fine-grained access control.
/// Format: subject has `relation` on object_type:object_id
#[table(public, accessor = auth_tuple)]
pub struct AuthTuple {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// Subject identifier (e.g., "user:<uuid>" or "team:<uuid>#member")
    #[index(btree)]
    pub subject: String,
    /// Relation name (e.g., "admin", "can_view", "member")
    pub relation: String,
    /// Object type (e.g., "org", "app", "env_type", "team", "gpg_key", "certificate")
    #[index(btree)]
    pub object_type: String,
    /// Object identifier (UUID)
    #[index(btree)]
    pub object_id: String,
    pub created_at: Timestamp,
}
