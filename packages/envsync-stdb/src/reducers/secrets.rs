use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::crypto::aes;
use crate::reducers::key_mgmt::{get_dek_at_version, get_or_create_dek};
use crate::tables::encrypted_secret::encrypted_secret as SecretTable;
use crate::tables::encrypted_secret::EncryptedSecret;
use crate::tables::reducer_response::reducer_response as ReducerResponseTable;
use crate::tables::reducer_response::ReducerResponse;

fn secret_aad(org_id: &str, app_id: &str, env_type_id: &str, key: &str) -> String {
    format!("secret:{org_id}:{app_id}:{env_type_id}:{key}")
}

/// Create a new encrypted secret. Value is already BYOK-encrypted by the caller;
/// STDB adds the KMS encryption layer atomically.
#[reducer]
pub fn create_secret(
    ctx: &ReducerContext,
    root_key_hex: String,
    org_id: String,
    app_id: String,
    env_type_id: String,
    key: String,
    value: String,
) -> Result<(), String> {
    let exists = ctx
        .db
        .encrypted_secret()
        .iter()
        .any(|s| s.org_id == org_id && s.app_id == app_id && s.env_type_id == env_type_id && s.key == key);

    if exists {
        return Err(format!("Secret '{key}' already exists"));
    }

    let scope_id = format!("{app_id}:secret");
    let (dek, version) = get_or_create_dek(ctx, &root_key_hex, &org_id, &scope_id)?;
    let aad = secret_aad(&org_id, &app_id, &env_type_id, &key);
    let (ciphertext, nonce) = aes::encrypt(ctx, &dek, value.as_bytes(), &aad)?;

    let now = Timestamp::now();
    ctx.db.encrypted_secret().insert(EncryptedSecret {
        id: 0,
        org_id,
        app_id,
        env_type_id,
        key,
        ciphertext,
        nonce,
        key_version: version,
        created_at: now,
        updated_at: now,
    });

    Ok(())
}

/// Get and decrypt a secret. Writes result to reducer_response.
#[reducer]
pub fn get_secret(
    ctx: &ReducerContext,
    request_id: String,
    root_key_hex: String,
    org_id: String,
    app_id: String,
    env_type_id: String,
    key: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .encrypted_secret()
        .iter()
        .find(|s| s.org_id == org_id && s.app_id == app_id && s.env_type_id == env_type_id && s.key == key)
        .ok_or_else(|| format!("Secret '{key}' not found"))?;

    let scope_id = format!("{app_id}:secret");
    let dek = get_dek_at_version(ctx, &root_key_hex, &org_id, &scope_id, row.key_version)?;
    let aad = secret_aad(&org_id, &app_id, &env_type_id, &key);
    let plaintext = aes::decrypt(&dek, &row.ciphertext, &row.nonce, &aad)?;
    let value = String::from_utf8(plaintext).map_err(|e| format!("UTF-8: {e}"))?;

    let data = serde_json::json!({
        "key": key,
        "value": value,
        "created_at": row.created_at.to_micros_since_unix_epoch().to_string(),
    })
    .to_string();

    ctx.db.reducer_response().insert(ReducerResponse {
        id: 0,
        request_id,
        data,
        created_at: Timestamp::now(),
    });

    Ok(())
}

/// Update an existing encrypted secret.
#[reducer]
pub fn update_secret(
    ctx: &ReducerContext,
    root_key_hex: String,
    org_id: String,
    app_id: String,
    env_type_id: String,
    key: String,
    value: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .encrypted_secret()
        .iter()
        .find(|s| s.org_id == org_id && s.app_id == app_id && s.env_type_id == env_type_id && s.key == key)
        .ok_or_else(|| format!("Secret '{key}' not found"))?;

    let scope_id = format!("{app_id}:secret");
    let (dek, version) = get_or_create_dek(ctx, &root_key_hex, &org_id, &scope_id)?;
    let aad = secret_aad(&org_id, &app_id, &env_type_id, &key);
    let (ciphertext, nonce) = aes::encrypt(ctx, &dek, value.as_bytes(), &aad)?;

    let row_id = row.id;
    ctx.db.encrypted_secret().id().delete(row_id);
    ctx.db.encrypted_secret().insert(EncryptedSecret {
        id: row_id,
        org_id,
        app_id,
        env_type_id,
        key,
        ciphertext,
        nonce,
        key_version: version,
        created_at: row.created_at,
        updated_at: Timestamp::now(),
    });

    Ok(())
}

/// Delete a secret.
#[reducer]
pub fn delete_secret(
    ctx: &ReducerContext,
    org_id: String,
    app_id: String,
    env_type_id: String,
    key: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .encrypted_secret()
        .iter()
        .find(|s| s.org_id == org_id && s.app_id == app_id && s.env_type_id == env_type_id && s.key == key)
        .ok_or_else(|| format!("Secret '{key}' not found"))?;

    ctx.db.encrypted_secret().id().delete(row.id);
    Ok(())
}

/// List all secrets for a scope, decrypting each one. Writes result to reducer_response.
#[reducer]
pub fn list_secrets(
    ctx: &ReducerContext,
    request_id: String,
    root_key_hex: String,
    org_id: String,
    app_id: String,
    env_type_id: String,
) -> Result<(), String> {
    let rows: Vec<_> = ctx
        .db
        .encrypted_secret()
        .iter()
        .filter(|s| s.org_id == org_id && s.app_id == app_id && s.env_type_id == env_type_id)
        .collect();

    let scope_id = format!("{app_id}:secret");
    let mut results = Vec::with_capacity(rows.len());

    for row in &rows {
        let dek = get_dek_at_version(ctx, &root_key_hex, &org_id, &scope_id, row.key_version)?;
        let aad = secret_aad(&org_id, &app_id, &env_type_id, &row.key);
        let plaintext = aes::decrypt(&dek, &row.ciphertext, &row.nonce, &aad)?;
        let value = String::from_utf8(plaintext).map_err(|e| format!("UTF-8: {e}"))?;

        results.push(serde_json::json!({
            "key": row.key,
            "value": value,
            "created_at": row.created_at.to_micros_since_unix_epoch().to_string(),
        }));
    }

    let data = serde_json::to_string(&results).map_err(|e| format!("serialize: {e}"))?;

    ctx.db.reducer_response().insert(ReducerResponse {
        id: 0,
        request_id,
        data,
        created_at: Timestamp::now(),
    });

    Ok(())
}

/// Batch create secrets.
#[reducer]
pub fn batch_create_secrets(
    ctx: &ReducerContext,
    root_key_hex: String,
    org_id: String,
    app_id: String,
    env_type_id: String,
    items_json: String,
) -> Result<(), String> {
    let items: Vec<serde_json::Value> =
        serde_json::from_str(&items_json).map_err(|e| format!("parse: {e}"))?;

    let scope_id = format!("{app_id}:secret");
    let (dek, version) = get_or_create_dek(ctx, &root_key_hex, &org_id, &scope_id)?;
    let now = Timestamp::now();

    for item in &items {
        let key = item["key"].as_str().ok_or("missing key")?;
        let value = item["value"].as_str().ok_or("missing value")?;

        let aad = secret_aad(&org_id, &app_id, &env_type_id, key);
        let (ciphertext, nonce) = aes::encrypt(ctx, &dek, value.as_bytes(), &aad)?;

        ctx.db.encrypted_secret().insert(EncryptedSecret {
            id: 0,
            org_id: org_id.clone(),
            app_id: app_id.clone(),
            env_type_id: env_type_id.clone(),
            key: key.to_string(),
            ciphertext,
            nonce,
            key_version: version,
            created_at: now,
            updated_at: now,
        });
    }

    Ok(())
}

/// Batch update secrets.
#[reducer]
pub fn batch_update_secrets(
    ctx: &ReducerContext,
    root_key_hex: String,
    org_id: String,
    app_id: String,
    env_type_id: String,
    items_json: String,
) -> Result<(), String> {
    let items: Vec<serde_json::Value> =
        serde_json::from_str(&items_json).map_err(|e| format!("parse: {e}"))?;

    let scope_id = format!("{app_id}:secret");
    let (dek, version) = get_or_create_dek(ctx, &root_key_hex, &org_id, &scope_id)?;

    for item in &items {
        let key = item["key"].as_str().ok_or("missing key")?;
        let value = item["value"].as_str().ok_or("missing value")?;

        let row = ctx
            .db
            .encrypted_secret()
            .iter()
            .find(|s| s.org_id == org_id && s.app_id == app_id && s.env_type_id == env_type_id && s.key == key)
            .ok_or_else(|| format!("Secret '{key}' not found"))?;

        let aad = secret_aad(&org_id, &app_id, &env_type_id, key);
        let (ciphertext, nonce) = aes::encrypt(ctx, &dek, value.as_bytes(), &aad)?;

        let row_id = row.id;
        let created_at = row.created_at;
        ctx.db.encrypted_secret().id().delete(row_id);
        ctx.db.encrypted_secret().insert(EncryptedSecret {
            id: row_id,
            org_id: org_id.clone(),
            app_id: app_id.clone(),
            env_type_id: env_type_id.clone(),
            key: key.to_string(),
            ciphertext,
            nonce,
            key_version: version,
            created_at,
            updated_at: Timestamp::now(),
        });
    }

    Ok(())
}

/// Batch delete secrets.
#[reducer]
pub fn batch_delete_secrets(
    ctx: &ReducerContext,
    org_id: String,
    app_id: String,
    env_type_id: String,
    keys_json: String,
) -> Result<(), String> {
    let keys: Vec<String> =
        serde_json::from_str(&keys_json).map_err(|e| format!("parse: {e}"))?;

    for key in &keys {
        let row = ctx
            .db
            .encrypted_secret()
            .iter()
            .find(|s| s.org_id == org_id && s.app_id == app_id && s.env_type_id == env_type_id && s.key == *key)
            .ok_or_else(|| format!("Secret '{key}' not found"))?;

        ctx.db.encrypted_secret().id().delete(row.id);
    }

    Ok(())
}
