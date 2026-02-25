use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::tables::org::org as OrgTable;
use crate::tables::org::Org;
use crate::tables::reducer_response::reducer_response as ReducerResponseTable;
use crate::tables::reducer_response::ReducerResponse;

#[reducer]
pub fn create_org(
    ctx: &ReducerContext,
    uuid: String,
    name: String,
    slug: String,
    logo_url: String,
    size: String,
    website: String,
    metadata: String,
) -> Result<(), String> {
    if ctx.db.org().slug().find(&slug).is_some() {
        return Err(format!("Org with slug '{}' already exists", slug));
    }

    let now = Timestamp::now();
    ctx.db.org().insert(Org {
        id: 0,
        uuid,
        name,
        logo_url,
        slug,
        size,
        website,
        metadata,
        created_at: now,
        updated_at: now,
    });
    Ok(())
}

#[reducer]
pub fn update_org(
    ctx: &ReducerContext,
    uuid: String,
    name: String,
    logo_url: String,
    size: String,
    website: String,
    metadata: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .org()
        .iter()
        .find(|o| o.uuid == uuid)
        .ok_or_else(|| format!("Org '{}' not found", uuid))?;

    let updated = Org {
        name,
        logo_url,
        size,
        website,
        metadata,
        updated_at: Timestamp::now(),
        ..row
    };
    ctx.db.org().id().update(updated);
    Ok(())
}

#[reducer]
pub fn delete_org(ctx: &ReducerContext, uuid: String) -> Result<(), String> {
    let row = ctx
        .db
        .org()
        .iter()
        .find(|o| o.uuid == uuid)
        .ok_or_else(|| format!("Org '{}' not found", uuid))?;
    ctx.db.org().id().delete(row.id);
    Ok(())
}

#[reducer]
pub fn get_org_by_slug(
    ctx: &ReducerContext,
    request_id: String,
    slug: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .org()
        .slug()
        .find(&slug)
        .ok_or_else(|| format!("Org with slug '{}' not found", slug))?;

    let data = serde_json::json!({
        "id": row.uuid,
        "name": row.name,
        "slug": row.slug,
        "logo_url": row.logo_url,
        "size": row.size,
        "website": row.website,
        "metadata": row.metadata,
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
