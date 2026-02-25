use spacetimedb::{table, Timestamp};

/// User settings — replaces PostgreSQL `settings` table.
#[table(public, accessor = user_settings)]
pub struct UserSettings {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// UUID string used as external identifier
    pub uuid: String,
    #[unique]
    pub user_id: String,
    pub email_notifications: bool,
    pub theme: String,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}
