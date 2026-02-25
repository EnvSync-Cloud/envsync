use spacetimedb::{table, Timestamp};

/// Encrypted secret — replaces Vault KV for secrets.
#[table(public, accessor = encrypted_secret)]
pub struct EncryptedSecret {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[index(btree)]
    pub org_id: String,
    #[index(btree)]
    pub app_id: String,
    pub env_type_id: String,
    pub key: String,
    /// AES-256-GCM ciphertext (base64)
    pub ciphertext: String,
    /// Nonce (base64)
    pub nonce: String,
    /// Key version used for encryption
    pub key_version: u32,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}
