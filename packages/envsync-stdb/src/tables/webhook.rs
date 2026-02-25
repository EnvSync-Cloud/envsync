use spacetimedb::{table, Timestamp};

/// Webhook — replaces PostgreSQL `webhook_store` table.
#[table(public, accessor = webhook)]
pub struct Webhook {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// UUID string used as external identifier
    pub uuid: String,
    pub name: String,
    #[index(btree)]
    pub org_id: String,
    pub user_id: String,
    pub url: String,
    /// JSON array of event type strings
    pub event_types: String,
    pub is_active: bool,
    /// "CUSTOM" | "DISCORD" | "SLACK"
    pub webhook_type: String,
    pub app_id: String,
    /// "org" | "app"
    pub linked_to: String,
    pub last_triggered_at: String,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}
