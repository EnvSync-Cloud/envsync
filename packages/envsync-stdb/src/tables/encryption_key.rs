use spacetimedb::{table, Timestamp};

/// Data Encryption Key (DEK) per (org_id, scope_id).
/// The `encrypted_dek` is the DEK encrypted with the root KEK using AES-256-GCM.
#[table(public, accessor = encryption_key)]
pub struct EncryptionKey {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[index(btree)]
    pub org_id: String,
    pub scope_id: String,
    /// AES-256-GCM encrypted DEK (base64)
    pub encrypted_dek: String,
    /// Nonce used for DEK encryption (base64)
    pub dek_nonce: String,
    pub version: u32,
    pub created_at: Timestamp,
}
