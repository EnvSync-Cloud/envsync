use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::tables::auth_tuple::auth_tuple as AuthTupleTable;
use crate::tables::auth_tuple::AuthTuple;
use crate::tables::env_type::env_type as EnvTypeTable;
use crate::tables::env_type::EnvType;

#[reducer]
pub fn create_env_type(
    ctx: &ReducerContext,
    uuid: String,
    org_id: String,
    name: String,
    app_id: String,
    is_default: bool,
    is_protected: bool,
    color: String,
) -> Result<(), String> {
    let now = Timestamp::now();
    ctx.db.env_type().insert(EnvType {
        id: 0,
        uuid,
        org_id,
        name,
        app_id,
        is_default,
        is_protected,
        color,
        created_at: now,
        updated_at: now,
    });
    Ok(())
}

#[reducer]
pub fn update_env_type(
    ctx: &ReducerContext,
    uuid: String,
    name: String,
    is_protected: bool,
    color: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .env_type()
        .iter()
        .find(|e| e.uuid == uuid)
        .ok_or_else(|| format!("EnvType '{}' not found", uuid))?;

    let updated = EnvType {
        name,
        is_protected,
        color,
        updated_at: Timestamp::now(),
        ..row
    };
    ctx.db.env_type().id().update(updated);
    Ok(())
}

#[reducer]
pub fn delete_env_type(ctx: &ReducerContext, uuid: String) -> Result<(), String> {
    let row = ctx
        .db
        .env_type()
        .iter()
        .find(|e| e.uuid == uuid)
        .ok_or_else(|| format!("EnvType '{}' not found", uuid))?;
    ctx.db.env_type().id().delete(row.id);
    Ok(())
}

/// Atomic: create env_type + write auth tuples (replaces saga)
#[reducer]
pub fn create_env_type_with_auth(
    ctx: &ReducerContext,
    uuid: String,
    org_id: String,
    name: String,
    app_id: String,
    is_default: bool,
    is_protected: bool,
    color: String,
) -> Result<(), String> {
    let now = Timestamp::now();
    ctx.db.env_type().insert(EnvType {
        id: 0,
        uuid: uuid.clone(),
        org_id: org_id.clone(),
        name,
        app_id: app_id.clone(),
        is_default,
        is_protected,
        color,
        created_at: now,
        updated_at: now,
    });

    // Write env_type→app structural tuple
    ctx.db.auth_tuple().insert(AuthTuple {
        id: 0,
        subject: format!("app:{}", app_id),
        relation: "app".to_string(),
        object_type: "env_type".to_string(),
        object_id: uuid.clone(),
        created_at: now,
    });

    // Write env_type→org structural tuple
    ctx.db.auth_tuple().insert(AuthTuple {
        id: 0,
        subject: format!("org:{}", org_id),
        relation: "org".to_string(),
        object_type: "env_type".to_string(),
        object_id: uuid,
        created_at: now,
    });

    Ok(())
}
