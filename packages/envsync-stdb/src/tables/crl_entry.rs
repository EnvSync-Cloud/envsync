use spacetimedb::{table, Timestamp};

/// Certificate revocation list entry.
#[table(public, accessor = crl_entry)]
pub struct CrlEntry {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[index(btree)]
    pub org_id: String,
    pub serial_hex: String,
    pub reason: u32,
    pub revoked_at: Timestamp,
}
