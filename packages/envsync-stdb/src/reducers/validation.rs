use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::tables::encrypted_env_var::encrypted_env_var as EnvVarTable;
use crate::tables::encrypted_secret::encrypted_secret as SecretTable;
use crate::tables::reducer_response::reducer_response as ReducerResponseTable;
use crate::tables::reducer_response::ReducerResponse;

/// Check if a key exists in either env or secret tables for a given scope.
/// Writes result to reducer_response.
#[reducer]
pub fn check_key_exists(
    ctx: &ReducerContext,
    request_id: String,
    org_id: String,
    app_id: String,
    env_type_id: String,
    key: String,
    exclude_table: String,
) -> Result<(), String> {
    if exclude_table != "env_store" {
        let env_exists = ctx
            .db
            .encrypted_env_var()
            .iter()
            .any(|e| e.org_id == org_id && e.app_id == app_id && e.env_type_id == env_type_id && e.key == key);
        if env_exists {
            let data = serde_json::json!({
                "exists": true,
                "type": "environment_variable",
                "message": format!("Key \"{key}\" already exists as an environment variable"),
            })
            .to_string();

            ctx.db.reducer_response().insert(ReducerResponse {
                id: 0,
                request_id,
                data,
                created_at: Timestamp::now(),
            });
            return Ok(());
        }
    }

    if exclude_table != "secret_store" {
        let secret_exists = ctx
            .db
            .encrypted_secret()
            .iter()
            .any(|s| s.org_id == org_id && s.app_id == app_id && s.env_type_id == env_type_id && s.key == key);
        if secret_exists {
            let data = serde_json::json!({
                "exists": true,
                "type": "secret",
                "message": format!("Key \"{key}\" already exists as a secret"),
            })
            .to_string();

            ctx.db.reducer_response().insert(ReducerResponse {
                id: 0,
                request_id,
                data,
                created_at: Timestamp::now(),
            });
            return Ok(());
        }
    }

    let data = serde_json::json!({
        "exists": false,
        "type": null,
        "message": null,
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

/// List all keys in a scope (both env and secret tables). Writes result to reducer_response.
#[reducer]
pub fn list_keys_in_scope(
    ctx: &ReducerContext,
    request_id: String,
    org_id: String,
    app_id: String,
    env_type_id: String,
) -> Result<(), String> {
    let env_keys: Vec<String> = ctx
        .db
        .encrypted_env_var()
        .iter()
        .filter(|e| e.org_id == org_id && e.app_id == app_id && e.env_type_id == env_type_id)
        .map(|e| e.key.clone())
        .collect();

    let secret_keys: Vec<String> = ctx
        .db
        .encrypted_secret()
        .iter()
        .filter(|s| s.org_id == org_id && s.app_id == app_id && s.env_type_id == env_type_id)
        .map(|s| s.key.clone())
        .collect();

    let data = serde_json::json!({
        "env_keys": env_keys,
        "secret_keys": secret_keys,
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
