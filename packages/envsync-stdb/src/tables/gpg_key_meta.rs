use spacetimedb::{table, Timestamp};

/// GPG key metadata — replaces PostgreSQL `gpg_keys` table.
/// Actual encrypted key material is in `encrypted_gpg` table.
#[table(public, accessor = gpg_key_meta)]
pub struct GpgKeyMeta {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// UUID string used as external identifier
    pub uuid: String,
    #[index(btree)]
    pub org_id: String,
    pub user_id: String,
    pub name: String,
    pub email: String,
    #[unique]
    pub fingerprint: String,
    pub key_id: String,
    pub algorithm: String,
    pub key_size: u32,
    pub public_key: String,
    pub private_key_ref: String,
    /// JSON array of usage flag strings
    pub usage_flags: String,
    pub trust_level: String,
    pub expires_at: String,
    pub revoked_at: String,
    pub revocation_reason: String,
    pub is_default: bool,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}
