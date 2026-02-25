use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::tables::env_store_pit::env_store_pit as EnvStorePitTable;
use crate::tables::env_store_pit::EnvStorePit;
use crate::tables::reducer_response::reducer_response as ReducerResponseTable;
use crate::tables::reducer_response::ReducerResponse;
use crate::tables::secret_store_pit::secret_store_pit as SecretStorePitTable;
use crate::tables::secret_store_pit::SecretStorePit;

#[reducer]
pub fn create_env_pit(
    ctx: &ReducerContext,
    uuid: String,
    org_id: String,
    env_type_id: String,
    user_id: String,
    app_id: String,
    change_request_message: String,
    changes: String,
) -> Result<(), String> {
    let now = Timestamp::now();
    ctx.db.env_store_pit().insert(EnvStorePit {
        id: 0,
        uuid,
        org_id,
        env_type_id,
        user_id,
        app_id,
        change_request_message,
        changes,
        created_at: now,
        updated_at: now,
    });
    Ok(())
}

/// Replay env var changes up to a specific PiT ID to reconstruct state.
#[reducer]
pub fn get_envs_at_pit(
    ctx: &ReducerContext,
    request_id: String,
    org_id: String,
    app_id: String,
    env_type_id: String,
    pit_uuid: String,
) -> Result<(), String> {
    // Collect all PiT entries for this scope, ordered by id (chronological)
    let mut entries: Vec<_> = ctx
        .db
        .env_store_pit()
        .iter()
        .filter(|p| {
            p.org_id == org_id && p.app_id == app_id && p.env_type_id == env_type_id
        })
        .collect();
    entries.sort_by_key(|e| e.id);

    // Replay changes up to target PiT
    let mut state: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for entry in entries {
        let changes: Vec<serde_json::Value> = serde_json::from_str(&entry.changes)
            .map_err(|e| format!("Invalid changes JSON: {e}"))?;

        for change in &changes {
            let key = change["key"].as_str().unwrap_or_default().to_string();
            let value = change["value"].as_str().unwrap_or_default().to_string();
            let op = change["operation"].as_str().unwrap_or_default();

            match op {
                "CREATE" | "UPDATE" => {
                    state.insert(key, value);
                }
                "DELETE" => {
                    state.remove(&key);
                }
                _ => {}
            }
        }

        if entry.uuid == pit_uuid {
            break;
        }
    }

    let result: Vec<serde_json::Value> = state
        .into_iter()
        .map(|(k, v)| serde_json::json!({ "key": k, "value": v }))
        .collect();

    ctx.db.reducer_response().insert(ReducerResponse {
        id: 0,
        request_id,
        data: serde_json::to_string(&result).unwrap_or_else(|_| "[]".to_string()),
        created_at: Timestamp::now(),
    });
    Ok(())
}

#[reducer]
pub fn create_secret_pit(
    ctx: &ReducerContext,
    uuid: String,
    org_id: String,
    env_type_id: String,
    user_id: String,
    app_id: String,
    change_request_message: String,
    changes: String,
) -> Result<(), String> {
    let now = Timestamp::now();
    ctx.db.secret_store_pit().insert(SecretStorePit {
        id: 0,
        uuid,
        org_id,
        env_type_id,
        user_id,
        app_id,
        change_request_message,
        changes,
        created_at: now,
        updated_at: now,
    });
    Ok(())
}

/// Replay secret changes up to a specific PiT ID to reconstruct state.
#[reducer]
pub fn get_secrets_at_pit(
    ctx: &ReducerContext,
    request_id: String,
    org_id: String,
    app_id: String,
    env_type_id: String,
    pit_uuid: String,
) -> Result<(), String> {
    let mut entries: Vec<_> = ctx
        .db
        .secret_store_pit()
        .iter()
        .filter(|p| {
            p.org_id == org_id && p.app_id == app_id && p.env_type_id == env_type_id
        })
        .collect();
    entries.sort_by_key(|e| e.id);

    let mut state: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for entry in entries {
        let changes: Vec<serde_json::Value> = serde_json::from_str(&entry.changes)
            .map_err(|e| format!("Invalid changes JSON: {e}"))?;

        for change in &changes {
            let key = change["key"].as_str().unwrap_or_default().to_string();
            let value = change["value"].as_str().unwrap_or_default().to_string();
            let op = change["operation"].as_str().unwrap_or_default();

            match op {
                "CREATE" | "UPDATE" => {
                    state.insert(key, value);
                }
                "DELETE" => {
                    state.remove(&key);
                }
                _ => {}
            }
        }

        if entry.uuid == pit_uuid {
            break;
        }
    }

    let result: Vec<serde_json::Value> = state
        .into_iter()
        .map(|(k, v)| serde_json::json!({ "key": k, "value": v }))
        .collect();

    ctx.db.reducer_response().insert(ReducerResponse {
        id: 0,
        request_id,
        data: serde_json::to_string(&result).unwrap_or_else(|_| "[]".to_string()),
        created_at: Timestamp::now(),
    });
    Ok(())
}
