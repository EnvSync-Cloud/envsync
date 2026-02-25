use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::tables::reducer_response::reducer_response as ReducerResponseTable;
use crate::tables::reducer_response::ReducerResponse;
use crate::tables::user::user as UserTable;
use crate::tables::user::User;

#[reducer]
pub fn create_user(
    ctx: &ReducerContext,
    uuid: String,
    email: String,
    org_id: String,
    role_id: String,
    auth_service_id: String,
    full_name: String,
    profile_picture_url: String,
    is_active: bool,
) -> Result<(), String> {
    if ctx.db.user().email().find(&email).is_some() {
        return Err(format!("User with email '{}' already exists", email));
    }

    let now = Timestamp::now();
    ctx.db.user().insert(User {
        id: 0,
        uuid,
        email,
        org_id,
        role_id,
        auth_service_id,
        full_name,
        profile_picture_url,
        last_login: String::new(),
        is_active,
        created_at: now,
        updated_at: now,
    });
    Ok(())
}

#[reducer]
pub fn update_user(
    ctx: &ReducerContext,
    uuid: String,
    email: String,
    role_id: String,
    full_name: String,
    profile_picture_url: String,
    is_active: bool,
) -> Result<(), String> {
    let row = ctx
        .db
        .user()
        .iter()
        .find(|u| u.uuid == uuid)
        .ok_or_else(|| format!("User '{}' not found", uuid))?;

    let updated = User {
        email,
        role_id,
        full_name,
        profile_picture_url,
        is_active,
        updated_at: Timestamp::now(),
        ..row
    };
    ctx.db.user().id().update(updated);
    Ok(())
}

#[reducer]
pub fn update_user_last_login(ctx: &ReducerContext, uuid: String) -> Result<(), String> {
    let row = ctx
        .db
        .user()
        .iter()
        .find(|u| u.uuid == uuid)
        .ok_or_else(|| format!("User '{}' not found", uuid))?;

    let now = Timestamp::now();
    let updated = User {
        last_login: now.to_micros_since_unix_epoch().to_string(),
        updated_at: now,
        ..row
    };
    ctx.db.user().id().update(updated);
    Ok(())
}

#[reducer]
pub fn delete_user(ctx: &ReducerContext, uuid: String) -> Result<(), String> {
    let row = ctx
        .db
        .user()
        .iter()
        .find(|u| u.uuid == uuid)
        .ok_or_else(|| format!("User '{}' not found", uuid))?;
    ctx.db.user().id().delete(row.id);
    Ok(())
}

#[reducer]
pub fn get_user_by_auth_id(
    ctx: &ReducerContext,
    request_id: String,
    auth_service_id: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .user()
        .iter()
        .find(|u| u.auth_service_id == auth_service_id)
        .ok_or_else(|| format!("User with auth_id '{}' not found", auth_service_id))?;

    let data = serde_json::json!({
        "id": row.uuid,
        "email": row.email,
        "org_id": row.org_id,
        "role_id": row.role_id,
        "auth_service_id": row.auth_service_id,
        "full_name": row.full_name,
        "profile_picture_url": row.profile_picture_url,
        "last_login": row.last_login,
        "is_active": row.is_active,
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
