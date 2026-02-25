use spacetimedb::{table, Timestamp};

/// Encrypted environment variable — replaces Vault KV for env vars.
#[table(public, accessor = encrypted_env_var)]
pub struct EncryptedEnvVar {
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
