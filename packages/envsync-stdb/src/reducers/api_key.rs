use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::tables::api_key::api_key as ApiKeyTable;
use crate::tables::api_key::ApiKey;
use crate::tables::reducer_response::reducer_response as ReducerResponseTable;
use crate::tables::reducer_response::ReducerResponse;

#[reducer]
pub fn create_api_key(
    ctx: &ReducerContext,
    uuid: String,
    org_id: String,
    user_id: String,
    key: String,
    description: String,
) -> Result<(), String> {
    let now = Timestamp::now();
    ctx.db.api_key().insert(ApiKey {
        id: 0,
        uuid,
        org_id,
        user_id,
        key,
        description,
        is_active: true,
        last_used_at: String::new(),
        created_at: now,
        updated_at: now,
    });
    Ok(())
}

#[reducer]
pub fn update_api_key(
    ctx: &ReducerContext,
    uuid: String,
    description: String,
    is_active: bool,
) -> Result<(), String> {
    let row = ctx
        .db
        .api_key()
        .iter()
        .find(|k| k.uuid == uuid)
        .ok_or_else(|| format!("API key '{}' not found", uuid))?;

    let updated = ApiKey {
        description,
        is_active,
        updated_at: Timestamp::now(),
        ..row
    };
    ctx.db.api_key().id().update(updated);
    Ok(())
}

#[reducer]
pub fn delete_api_key(ctx: &ReducerContext, uuid: String) -> Result<(), String> {
    let row = ctx
        .db
        .api_key()
        .iter()
        .find(|k| k.uuid == uuid)
        .ok_or_else(|| format!("API key '{}' not found", uuid))?;
    ctx.db.api_key().id().delete(row.id);
    Ok(())
}

#[reducer]
pub fn update_api_key_last_used(ctx: &ReducerContext, key: String) -> Result<(), String> {
    let row = ctx
        .db
        .api_key()
        .key()
        .find(&key)
        .ok_or_else(|| "API key not found".to_string())?;

    let now = Timestamp::now();
    let updated = ApiKey {
        last_used_at: now.to_micros_since_unix_epoch().to_string(),
        updated_at: now,
        ..row
    };
    ctx.db.api_key().id().update(updated);
    Ok(())
}

/// Get API key by key string — returns via reducer_response
#[reducer]
pub fn get_api_key_by_key(
    ctx: &ReducerContext,
    request_id: String,
    key: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .api_key()
        .key()
        .find(&key)
        .ok_or_else(|| "API key not found".to_string())?;

    let data = serde_json::json!({
        "id": row.uuid,
        "org_id": row.org_id,
        "user_id": row.user_id,
        "key": row.key,
        "description": row.description,
        "is_active": row.is_active,
        "last_used_at": row.last_used_at,
        "created_at": row.created_at.to_micros_since_unix_epoch(),
        "updated_at": row.updated_at.to_micros_since_unix_epoch(),
    });

    ctx.db.reducer_response().insert(ReducerResponse {
        id: 0,
        request_id,
        data: data.to_string(),
        created_at: Timestamp::now(),
    });
    Ok(())
}
