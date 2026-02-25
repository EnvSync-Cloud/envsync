use spacetimedb::{table, Timestamp};

/// User — replaces PostgreSQL `users` table.
#[table(public, accessor = user)]
pub struct User {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// UUID string used as external identifier
    pub uuid: String,
    #[unique]
    pub email: String,
    #[index(btree)]
    pub org_id: String,
    pub role_id: String,
    /// Keycloak user ID
    pub auth_service_id: String,
    pub full_name: String,
    pub profile_picture_url: String,
    pub last_login: String,
    pub is_active: bool,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}
