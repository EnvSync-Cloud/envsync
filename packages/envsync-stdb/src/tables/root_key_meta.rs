use spacetimedb::{table, Timestamp};

/// KEK metadata — tracks root key derivation info.
#[table(public, accessor = root_key_meta)]
pub struct RootKeyMeta {
    #[primary_key]
    pub id: u32,
    /// HKDF info string used for derivation
    pub hkdf_info: String,
    /// SHA-256 hash of the derived KEK (for verification, not the key itself)
    pub kek_hash: String,
    pub initialized_at: Timestamp,
}
