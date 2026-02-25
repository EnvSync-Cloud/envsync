use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::tables::app::app as AppTable;
use crate::tables::app::App;
use crate::tables::auth_tuple::auth_tuple as AuthTupleTable;
use crate::tables::auth_tuple::AuthTuple;

#[reducer]
pub fn create_app(
    ctx: &ReducerContext,
    uuid: String,
    name: String,
    org_id: String,
    description: String,
    enable_secrets: bool,
    is_managed_secret: bool,
    public_key: String,
    private_key: String,
    metadata: String,
) -> Result<(), String> {
    let now = Timestamp::now();
    ctx.db.app().insert(App {
        id: 0,
        uuid,
        name,
        org_id,
        description,
        enable_secrets,
        is_managed_secret,
        public_key,
        private_key,
        metadata,
        kms_key_version_id: String::new(),
        encryption_migrated: true,
        created_at: now,
        updated_at: now,
    });
    Ok(())
}

#[reducer]
pub fn update_app(
    ctx: &ReducerContext,
    uuid: String,
    name: String,
    description: String,
    metadata: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .app()
        .iter()
        .find(|a| a.uuid == uuid)
        .ok_or_else(|| format!("App '{}' not found", uuid))?;

    let updated = App {
        name,
        description,
        metadata,
        updated_at: Timestamp::now(),
        ..row
    };
    ctx.db.app().id().update(updated);
    Ok(())
}

#[reducer]
pub fn delete_app(ctx: &ReducerContext, uuid: String) -> Result<(), String> {
    let row = ctx
        .db
        .app()
        .iter()
        .find(|a| a.uuid == uuid)
        .ok_or_else(|| format!("App '{}' not found", uuid))?;
    ctx.db.app().id().delete(row.id);
    Ok(())
}

/// Atomic: create app + write auth tuples (replaces saga)
#[reducer]
pub fn create_app_with_auth(
    ctx: &ReducerContext,
    uuid: String,
    name: String,
    org_id: String,
    description: String,
    enable_secrets: bool,
    is_managed_secret: bool,
    public_key: String,
    private_key: String,
    metadata: String,
) -> Result<(), String> {
    let now = Timestamp::now();
    ctx.db.app().insert(App {
        id: 0,
        uuid: uuid.clone(),
        name,
        org_id: org_id.clone(),
        description,
        enable_secrets,
        is_managed_secret,
        public_key,
        private_key,
        metadata,
        kms_key_version_id: String::new(),
        encryption_migrated: true,
        created_at: now,
        updated_at: now,
    });

    // Write app→org structural tuple
    ctx.db.auth_tuple().insert(AuthTuple {
        id: 0,
        subject: format!("org:{}", org_id),
        relation: "org".to_string(),
        object_type: "app".to_string(),
        object_id: uuid,
        created_at: now,
    });

    Ok(())
}
