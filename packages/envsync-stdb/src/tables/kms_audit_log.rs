use spacetimedb::{table, Timestamp};

/// Hash-chained audit trail for KMS operations.
#[table(public, accessor = kms_audit_log)]
pub struct KmsAuditLog {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub action: String,
    pub org_id: String,
    pub scope_id: String,
    pub detail: String,
    /// SHA-256 hash of previous entry for chain integrity
    pub prev_hash: String,
    /// SHA-256 hash of this entry
    pub entry_hash: String,
    pub created_at: Timestamp,
}
