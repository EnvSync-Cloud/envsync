use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::crypto::kek::{derive_kek, hash_key};
use crate::tables::root_key_meta::root_key_meta as RootKeyMetaTable;
use crate::tables::root_key_meta::RootKeyMeta;
use crate::tables::sequences::sequence as SequenceTable;
use crate::tables::sequences::Sequence;

const HKDF_INFO: &str = "envsync:root:kek:v1";

/// Initialize the KMS module. Must be called once on first boot.
/// `root_key_hex` is the 32-byte hex-encoded root key from STDB_ROOT_KEY env var.
#[reducer]
pub fn init(ctx: &ReducerContext, root_key_hex: String) -> Result<(), String> {
    // Check if already initialized
    if ctx.db.root_key_meta().id().find(1).is_some() {
        return Err("Already initialized".into());
    }

    let root_key = hex::decode(&root_key_hex).map_err(|e| format!("hex decode: {e}"))?;
    if root_key.len() != 32 {
        return Err("Root key must be 32 bytes (64 hex chars)".into());
    }

    // Derive KEK
    let kek = derive_kek(&root_key, HKDF_INFO)?;
    let kek_hash = hash_key(&kek);

    // Store metadata
    ctx.db.root_key_meta().insert(RootKeyMeta {
        id: 1,
        hkdf_info: HKDF_INFO.to_string(),
        kek_hash,
        initialized_at: Timestamp::now(),
    });

    // Initialize sequence counters
    ctx.db.sequence().insert(Sequence {
        name: "cert_serial".to_string(),
        value: 1,
    });
    ctx.db.sequence().insert(Sequence {
        name: "crl_number".to_string(),
        value: 0,
    });

    Ok(())
}

/// Helper: get the derived KEK from the root key. Called internally by other reducers.
pub fn get_kek(root_key_hex: &str) -> Result<[u8; 32], String> {
    let root_key = hex::decode(root_key_hex).map_err(|e| format!("hex decode: {e}"))?;
    if root_key.len() != 32 {
        return Err("Root key must be 32 bytes".into());
    }
    derive_kek(&root_key, HKDF_INFO)
}
