use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::crypto::aes;
use crate::reducers::key_mgmt::{get_dek_at_version, get_or_create_dek};
use crate::tables::reducer_response::reducer_response as ReducerResponseTable;
use crate::tables::reducer_response::ReducerResponse;

/// Encrypt a plaintext value with the current DEK for (org_id, scope_id).
/// Writes JSON result to reducer_response table: { "ciphertext": "...", "nonce": "...", "key_version": N }
#[reducer]
pub fn encrypt(
    ctx: &ReducerContext,
    request_id: String,
    root_key_hex: String,
    org_id: String,
    scope_id: String,
    plaintext: String,
    aad: String,
) -> Result<(), String> {
    let (dek, version) = get_or_create_dek(ctx, &root_key_hex, &org_id, &scope_id)?;
    let (ciphertext, nonce) = aes::encrypt(ctx, &dek, plaintext.as_bytes(), &aad)?;

    let data = serde_json::json!({
        "ciphertext": ciphertext,
        "nonce": nonce,
        "key_version": version,
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

/// Decrypt a ciphertext with the specified DEK version.
/// Writes plaintext string to reducer_response table.
#[reducer]
pub fn decrypt(
    ctx: &ReducerContext,
    request_id: String,
    root_key_hex: String,
    org_id: String,
    scope_id: String,
    ciphertext: String,
    nonce: String,
    key_version: u32,
    aad: String,
) -> Result<(), String> {
    let dek = get_dek_at_version(ctx, &root_key_hex, &org_id, &scope_id, key_version)?;
    let plaintext_bytes = aes::decrypt(&dek, &ciphertext, &nonce, &aad)?;
    let plaintext = String::from_utf8(plaintext_bytes).map_err(|e| format!("UTF-8: {e}"))?;

    ctx.db.reducer_response().insert(ReducerResponse {
        id: 0,
        request_id,
        data: plaintext,
        created_at: Timestamp::now(),
    });

    Ok(())
}

/// Batch encrypt multiple items. Input is JSON array of { "plaintext": "...", "aad": "..." }.
/// Writes JSON array result to reducer_response table.
#[reducer]
pub fn batch_encrypt(
    ctx: &ReducerContext,
    request_id: String,
    root_key_hex: String,
    org_id: String,
    scope_id: String,
    items_json: String,
) -> Result<(), String> {
    let (dek, version) = get_or_create_dek(ctx, &root_key_hex, &org_id, &scope_id)?;

    let items: Vec<serde_json::Value> =
        serde_json::from_str(&items_json).map_err(|e| format!("parse items: {e}"))?;

    let mut results = Vec::with_capacity(items.len());

    for item in &items {
        let plaintext = item["plaintext"]
            .as_str()
            .ok_or("missing plaintext")?;
        let aad = item["aad"].as_str().ok_or("missing aad")?;

        let (ct, nonce) = aes::encrypt(ctx, &dek, plaintext.as_bytes(), aad)?;
        results.push(serde_json::json!({
            "ciphertext": ct,
            "nonce": nonce,
            "key_version": version,
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

/// Batch decrypt multiple items.
/// Writes JSON array of { "plaintext": "..." } to reducer_response table.
#[reducer]
pub fn batch_decrypt(
    ctx: &ReducerContext,
    request_id: String,
    root_key_hex: String,
    org_id: String,
    scope_id: String,
    items_json: String,
) -> Result<(), String> {
    let items: Vec<serde_json::Value> =
        serde_json::from_str(&items_json).map_err(|e| format!("parse items: {e}"))?;

    let mut results = Vec::with_capacity(items.len());

    for item in &items {
        let ct = item["ciphertext"].as_str().ok_or("missing ciphertext")?;
        let nonce = item["nonce"].as_str().ok_or("missing nonce")?;
        let kv = item["key_version"].as_u64().ok_or("missing key_version")? as u32;
        let aad = item["aad"].as_str().ok_or("missing aad")?;

        let dek = get_dek_at_version(ctx, &root_key_hex, &org_id, &scope_id, kv)?;
        let plaintext_bytes = aes::decrypt(&dek, ct, nonce, aad)?;
        let plaintext = String::from_utf8(plaintext_bytes).map_err(|e| format!("UTF-8: {e}"))?;
        results.push(serde_json::json!({ "plaintext": plaintext }));
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
