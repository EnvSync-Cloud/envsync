use sha2::{Digest, Sha256};
use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::tables::app_audit_log::app_audit_log as AppAuditLogTable;
use crate::tables::app_audit_log::AppAuditLog;

/// Create a hash-chained audit log entry.
/// STDB reducers are single-threaded per module, so the hash chain is naturally serialized.
#[reducer]
pub fn create_audit_entry(
    ctx: &ReducerContext,
    uuid: String,
    org_id: String,
    user_id: String,
    action: String,
    details: String,
    message: String,
) -> Result<(), String> {
    // Get the last entry's hash for chaining
    let previous_hash = ctx
        .db
        .app_audit_log()
        .iter()
        .filter(|e| e.org_id == org_id)
        .max_by_key(|e| e.id)
        .map(|e| e.entry_hash.clone())
        .unwrap_or_else(|| "genesis".to_string());

    let now = Timestamp::now();
    let now_micros = now.to_micros_since_unix_epoch();

    // Compute entry hash: SHA-256(previous_hash || org_id || user_id || action || details || message || timestamp)
    let mut hasher = Sha256::new();
    hasher.update(previous_hash.as_bytes());
    hasher.update(org_id.as_bytes());
    hasher.update(user_id.as_bytes());
    hasher.update(action.as_bytes());
    hasher.update(details.as_bytes());
    hasher.update(message.as_bytes());
    hasher.update(now_micros.to_le_bytes());
    let entry_hash = hex::encode(hasher.finalize());

    ctx.db.app_audit_log().insert(AppAuditLog {
        id: 0,
        uuid,
        org_id,
        user_id,
        action,
        details,
        message,
        previous_hash,
        entry_hash,
        created_at: now,
        updated_at: now,
    });

    Ok(())
}
