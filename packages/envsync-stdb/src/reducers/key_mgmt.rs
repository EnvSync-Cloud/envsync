use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::crypto::aes;
use crate::crypto::kek::derive_scope_key;
use crate::crypto::rng::random_bytes;
use crate::reducers::init::get_kek;
use crate::tables::encryption_key::encryption_key as EncryptionKeyTable;
use crate::tables::encryption_key::EncryptionKey;

/// Create a new Data Encryption Key (DEK) for (org_id, scope_id).
/// The DEK is a random 32-byte key encrypted with the scope-derived KEK.
#[reducer]
pub fn create_data_key(
    ctx: &ReducerContext,
    root_key_hex: String,
    org_id: String,
    scope_id: String,
) -> Result<(), String> {
    let kek = get_kek(&root_key_hex)?;
    let scope_key = derive_scope_key(&kek, &org_id, &scope_id)?;

    // Generate random DEK
    let dek = random_bytes(ctx, 32);

    // Encrypt DEK with scope key
    let aad = format!("dek:{org_id}:{scope_id}");
    let (encrypted_dek, nonce) = aes::encrypt(ctx, &scope_key, &dek, &aad)?;

    // Determine version
    let version = ctx
        .db
        .encryption_key()
        .iter()
        .filter(|k| k.org_id == org_id && k.scope_id == scope_id)
        .map(|k| k.version)
        .max()
        .unwrap_or(0)
        + 1;

    ctx.db.encryption_key().insert(EncryptionKey {
        id: 0, // auto_inc
        org_id,
        scope_id,
        encrypted_dek,
        dek_nonce: nonce,
        version,
        created_at: Timestamp::now(),
    });

    Ok(())
}

/// Rotate the DEK for (org_id, scope_id) — creates a new version.
#[reducer]
pub fn rotate_data_key(
    ctx: &ReducerContext,
    root_key_hex: String,
    org_id: String,
    scope_id: String,
) -> Result<(), String> {
    // Same as create_data_key — new version is automatically assigned
    create_data_key(ctx, root_key_hex, org_id, scope_id)
}

/// Get or create the current DEK for a scope. Returns the decrypted DEK bytes.
pub fn get_or_create_dek(
    ctx: &ReducerContext,
    root_key_hex: &str,
    org_id: &str,
    scope_id: &str,
) -> Result<([u8; 32], u32), String> {
    let kek = get_kek(root_key_hex)?;
    let scope_key = derive_scope_key(&kek, org_id, scope_id)?;

    // Find the latest version
    let latest = ctx
        .db
        .encryption_key()
        .iter()
        .filter(|k| k.org_id == org_id && k.scope_id == scope_id)
        .max_by_key(|k| k.version);

    match latest {
        Some(key_row) => {
            // Decrypt the DEK
            let aad = format!("dek:{org_id}:{scope_id}");
            let dek_bytes = aes::decrypt(&scope_key, &key_row.encrypted_dek, &key_row.dek_nonce, &aad)?;
            if dek_bytes.len() != 32 {
                return Err("DEK is not 32 bytes".into());
            }
            let mut dek = [0u8; 32];
            dek.copy_from_slice(&dek_bytes);
            Ok((dek, key_row.version))
        }
        None => {
            // Auto-create DEK
            let dek_raw = random_bytes(ctx, 32);
            let aad = format!("dek:{org_id}:{scope_id}");
            let (encrypted_dek, nonce) = aes::encrypt(ctx, &scope_key, &dek_raw, &aad)?;

            ctx.db.encryption_key().insert(EncryptionKey {
                id: 0,
                org_id: org_id.to_string(),
                scope_id: scope_id.to_string(),
                encrypted_dek,
                dek_nonce: nonce,
                version: 1,
                created_at: Timestamp::now(),
            });

            let mut dek = [0u8; 32];
            dek.copy_from_slice(&dek_raw);
            Ok((dek, 1))
        }
    }
}

/// Decrypt a DEK at a specific version.
pub fn get_dek_at_version(
    ctx: &ReducerContext,
    root_key_hex: &str,
    org_id: &str,
    scope_id: &str,
    version: u32,
) -> Result<[u8; 32], String> {
    let kek = get_kek(root_key_hex)?;
    let scope_key = derive_scope_key(&kek, org_id, scope_id)?;

    let key_row = ctx
        .db
        .encryption_key()
        .iter()
        .find(|k| k.org_id == org_id && k.scope_id == scope_id && k.version == version)
        .ok_or_else(|| format!("DEK not found: {org_id}/{scope_id} v{version}"))?;

    let aad = format!("dek:{org_id}:{scope_id}");
    let dek_bytes = aes::decrypt(&scope_key, &key_row.encrypted_dek, &key_row.dek_nonce, &aad)?;
    if dek_bytes.len() != 32 {
        return Err("DEK is not 32 bytes".into());
    }
    let mut dek = [0u8; 32];
    dek.copy_from_slice(&dek_bytes);
    Ok(dek)
}
