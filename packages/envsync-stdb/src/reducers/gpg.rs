use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::crypto::aes;
use crate::reducers::key_mgmt::{get_dek_at_version, get_or_create_dek};
use crate::tables::encrypted_gpg::encrypted_gpg as GpgTable;
use crate::tables::encrypted_gpg::EncryptedGpg;
use crate::tables::reducer_response::reducer_response as ReducerResponseTable;
use crate::tables::reducer_response::ReducerResponse;

fn gpg_aad(org_id: &str, fingerprint: &str, field: &str) -> String {
    format!("gpg:{org_id}:{fingerprint}:{field}")
}

/// Store GPG key material (encrypted private key + passphrase).
#[reducer]
pub fn store_gpg_material(
    ctx: &ReducerContext,
    root_key_hex: String,
    org_id: String,
    fingerprint: String,
    armored_private_key: String,
    passphrase: String,
) -> Result<(), String> {
    let scope_id = "gpg".to_string();
    let (dek, version) = get_or_create_dek(ctx, &root_key_hex, &org_id, &scope_id)?;

    let pk_aad = gpg_aad(&org_id, &fingerprint, "private_key");
    let (encrypted_pk, pk_nonce) = aes::encrypt(ctx, &dek, armored_private_key.as_bytes(), &pk_aad)?;

    let pp_aad = gpg_aad(&org_id, &fingerprint, "passphrase");
    let (encrypted_pp, pp_nonce) = aes::encrypt(ctx, &dek, passphrase.as_bytes(), &pp_aad)?;

    ctx.db.encrypted_gpg().insert(EncryptedGpg {
        id: 0,
        org_id,
        fingerprint,
        encrypted_private_key: encrypted_pk,
        private_key_nonce: pk_nonce,
        encrypted_passphrase: encrypted_pp,
        passphrase_nonce: pp_nonce,
        key_version: version,
        created_at: Timestamp::now(),
    });

    Ok(())
}

/// Get the decrypted passphrase for a GPG key. Writes result to reducer_response.
#[reducer]
pub fn get_gpg_passphrase(
    ctx: &ReducerContext,
    request_id: String,
    root_key_hex: String,
    org_id: String,
    fingerprint: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .encrypted_gpg()
        .iter()
        .find(|g| g.org_id == org_id && g.fingerprint == fingerprint)
        .ok_or_else(|| format!("GPG key '{fingerprint}' not found"))?;

    let scope_id = "gpg".to_string();
    let dek = get_dek_at_version(ctx, &root_key_hex, &org_id, &scope_id, row.key_version)?;
    let pp_aad = gpg_aad(&org_id, &fingerprint, "passphrase");
    let passphrase = aes::decrypt(&dek, &row.encrypted_passphrase, &row.passphrase_nonce, &pp_aad)?;
    let data = String::from_utf8(passphrase).map_err(|e| format!("UTF-8: {e}"))?;

    ctx.db.reducer_response().insert(ReducerResponse {
        id: 0,
        request_id,
        data,
        created_at: Timestamp::now(),
    });

    Ok(())
}

/// Get the decrypted private key for a GPG key. Writes result to reducer_response.
#[reducer]
pub fn get_gpg_private_key(
    ctx: &ReducerContext,
    request_id: String,
    root_key_hex: String,
    org_id: String,
    fingerprint: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .encrypted_gpg()
        .iter()
        .find(|g| g.org_id == org_id && g.fingerprint == fingerprint)
        .ok_or_else(|| format!("GPG key '{fingerprint}' not found"))?;

    let scope_id = "gpg".to_string();
    let dek = get_dek_at_version(ctx, &root_key_hex, &org_id, &scope_id, row.key_version)?;
    let pk_aad = gpg_aad(&org_id, &fingerprint, "private_key");
    let private_key = aes::decrypt(&dek, &row.encrypted_private_key, &row.private_key_nonce, &pk_aad)?;
    let data = String::from_utf8(private_key).map_err(|e| format!("UTF-8: {e}"))?;

    ctx.db.reducer_response().insert(ReducerResponse {
        id: 0,
        request_id,
        data,
        created_at: Timestamp::now(),
    });

    Ok(())
}

/// Delete GPG key material.
#[reducer]
pub fn delete_gpg_material(
    ctx: &ReducerContext,
    org_id: String,
    fingerprint: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .encrypted_gpg()
        .iter()
        .find(|g| g.org_id == org_id && g.fingerprint == fingerprint)
        .ok_or_else(|| format!("GPG key '{fingerprint}' not found"))?;

    ctx.db.encrypted_gpg().id().delete(row.id);
    Ok(())
}
