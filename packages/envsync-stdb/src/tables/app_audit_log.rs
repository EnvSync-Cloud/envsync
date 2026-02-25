use spacetimedb::{table, Timestamp};

/// Application audit log — replaces PostgreSQL `audit_log` table.
/// Hash-chained for integrity verification.
#[table(public, accessor = app_audit_log)]
pub struct AppAuditLog {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// UUID string used as external identifier
    pub uuid: String,
    #[index(btree)]
    pub org_id: String,
    pub user_id: String,
    pub action: String,
    pub details: String,
    pub message: String,
    /// SHA-256 hash of previous entry for chain integrity
    pub previous_hash: String,
    /// SHA-256 hash of this entry
    pub entry_hash: String,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}
