use spacetimedb::{table, Timestamp};

/// Encrypted GPG key material — replaces Vault KV for GPG keys.
#[table(public, accessor = encrypted_gpg)]
pub struct EncryptedGpg {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[index(btree)]
    pub org_id: String,
    pub fingerprint: String,
    /// AES-256-GCM encrypted armored private key (base64)
    pub encrypted_private_key: String,
    pub private_key_nonce: String,
    /// AES-256-GCM encrypted passphrase (base64)
    pub encrypted_passphrase: String,
    pub passphrase_nonce: String,
    /// Key version used for encryption
    pub key_version: u32,
    pub created_at: Timestamp,
}
