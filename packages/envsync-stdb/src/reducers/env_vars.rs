use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::crypto::aes;
use crate::reducers::key_mgmt::{get_dek_at_version, get_or_create_dek};
use crate::tables::encrypted_env_var::encrypted_env_var as EnvVarTable;
use crate::tables::encrypted_env_var::EncryptedEnvVar;
use crate::tables::reducer_response::reducer_response as ReducerResponseTable;
use crate::tables::reducer_response::ReducerResponse;

fn env_aad(org_id: &str, app_id: &str, env_type_id: &str, key: &str) -> String {
    format!("env:{org_id}:{app_id}:{env_type_id}:{key}")
}

/// Create a new encrypted environment variable. Encrypts + stores atomically.
#[reducer]
pub fn create_env(
    ctx: &ReducerContext,
    root_key_hex: String,
    org_id: String,
    app_id: String,
    env_type_id: String,
    key: String,
    plaintext: String,
) -> Result<(), String> {
    let exists = ctx
        .db
        .encrypted_env_var()
        .iter()
        .any(|e| e.org_id == org_id && e.app_id == app_id && e.env_type_id == env_type_id && e.key == key);

    if exists {
        return Err(format!("Env var '{key}' already exists"));
    }

    let scope_id = format!("{app_id}:env");
    let (dek, version) = get_or_create_dek(ctx, &root_key_hex, &org_id, &scope_id)?;
    let aad = env_aad(&org_id, &app_id, &env_type_id, &key);
    let (ciphertext, nonce) = aes::encrypt(ctx, &dek, plaintext.as_bytes(), &aad)?;

    let now = Timestamp::now();
    ctx.db.encrypted_env_var().insert(EncryptedEnvVar {
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

/// Get and decrypt an environment variable. Writes result to reducer_response.
#[reducer]
pub fn get_env(
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
        .encrypted_env_var()
        .iter()
        .find(|e| e.org_id == org_id && e.app_id == app_id && e.env_type_id == env_type_id && e.key == key)
        .ok_or_else(|| format!("Env var '{key}' not found"))?;

    let scope_id = format!("{app_id}:env");
    let dek = get_dek_at_version(ctx, &root_key_hex, &org_id, &scope_id, row.key_version)?;
    let aad = env_aad(&org_id, &app_id, &env_type_id, &key);
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

/// Update an existing encrypted environment variable.
#[reducer]
pub fn update_env(
    ctx: &ReducerContext,
    root_key_hex: String,
    org_id: String,
    app_id: String,
    env_type_id: String,
    key: String,
    plaintext: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .encrypted_env_var()
        .iter()
        .find(|e| e.org_id == org_id && e.app_id == app_id && e.env_type_id == env_type_id && e.key == key)
        .ok_or_else(|| format!("Env var '{key}' not found"))?;

    let scope_id = format!("{app_id}:env");
    let (dek, version) = get_or_create_dek(ctx, &root_key_hex, &org_id, &scope_id)?;
    let aad = env_aad(&org_id, &app_id, &env_type_id, &key);
    let (ciphertext, nonce) = aes::encrypt(ctx, &dek, plaintext.as_bytes(), &aad)?;

    let row_id = row.id;
    ctx.db.encrypted_env_var().id().delete(row_id);
    ctx.db.encrypted_env_var().insert(EncryptedEnvVar {
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

/// Delete an environment variable.
#[reducer]
pub fn delete_env(
    ctx: &ReducerContext,
    org_id: String,
    app_id: String,
    env_type_id: String,
    key: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .encrypted_env_var()
        .iter()
        .find(|e| e.org_id == org_id && e.app_id == app_id && e.env_type_id == env_type_id && e.key == key)
        .ok_or_else(|| format!("Env var '{key}' not found"))?;

    ctx.db.encrypted_env_var().id().delete(row.id);
    Ok(())
}

/// List all env vars for a scope, decrypting each one. Writes result to reducer_response.
#[reducer]
pub fn list_envs(
    ctx: &ReducerContext,
    request_id: String,
    root_key_hex: String,
    org_id: String,
    app_id: String,
    env_type_id: String,
) -> Result<(), String> {
    let rows: Vec<_> = ctx
        .db
        .encrypted_env_var()
        .iter()
        .filter(|e| e.org_id == org_id && e.app_id == app_id && e.env_type_id == env_type_id)
        .collect();

    let scope_id = format!("{app_id}:env");
    let mut results = Vec::with_capacity(rows.len());

    for row in &rows {
        let dek = get_dek_at_version(ctx, &root_key_hex, &org_id, &scope_id, row.key_version)?;
        let aad = env_aad(&org_id, &app_id, &env_type_id, &row.key);
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

/// Batch create env vars — encrypt + store atomically in a single transaction.
#[reducer]
pub fn batch_create_envs(
    ctx: &ReducerContext,
    root_key_hex: String,
    org_id: String,
    app_id: String,
    env_type_id: String,
    items_json: String,
) -> Result<(), String> {
    let items: Vec<serde_json::Value> =
        serde_json::from_str(&items_json).map_err(|e| format!("parse: {e}"))?;

    let scope_id = format!("{app_id}:env");
    let (dek, version) = get_or_create_dek(ctx, &root_key_hex, &org_id, &scope_id)?;
    let now = Timestamp::now();

    for item in &items {
        let key = item["key"].as_str().ok_or("missing key")?;
        let value = item["value"].as_str().ok_or("missing value")?;

        let aad = env_aad(&org_id, &app_id, &env_type_id, key);
        let (ciphertext, nonce) = aes::encrypt(ctx, &dek, value.as_bytes(), &aad)?;

        ctx.db.encrypted_env_var().insert(EncryptedEnvVar {
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

/// Batch update env vars.
#[reducer]
pub fn batch_update_envs(
    ctx: &ReducerContext,
    root_key_hex: String,
    org_id: String,
    app_id: String,
    env_type_id: String,
    items_json: String,
) -> Result<(), String> {
    let items: Vec<serde_json::Value> =
        serde_json::from_str(&items_json).map_err(|e| format!("parse: {e}"))?;

    let scope_id = format!("{app_id}:env");
    let (dek, version) = get_or_create_dek(ctx, &root_key_hex, &org_id, &scope_id)?;

    for item in &items {
        let key = item["key"].as_str().ok_or("missing key")?;
        let value = item["value"].as_str().ok_or("missing value")?;

        let row = ctx
            .db
            .encrypted_env_var()
            .iter()
            .find(|e| e.org_id == org_id && e.app_id == app_id && e.env_type_id == env_type_id && e.key == key)
            .ok_or_else(|| format!("Env var '{key}' not found"))?;

        let aad = env_aad(&org_id, &app_id, &env_type_id, key);
        let (ciphertext, nonce) = aes::encrypt(ctx, &dek, value.as_bytes(), &aad)?;

        let row_id = row.id;
        let created_at = row.created_at;
        ctx.db.encrypted_env_var().id().delete(row_id);
        ctx.db.encrypted_env_var().insert(EncryptedEnvVar {
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

/// Batch delete env vars.
#[reducer]
pub fn batch_delete_envs(
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
            .encrypted_env_var()
            .iter()
            .find(|e| e.org_id == org_id && e.app_id == app_id && e.env_type_id == env_type_id && e.key == *key)
            .ok_or_else(|| format!("Env var '{key}' not found"))?;

        ctx.db.encrypted_env_var().id().delete(row.id);
    }

    Ok(())
}
