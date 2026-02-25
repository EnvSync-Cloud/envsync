use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::tables::webhook::webhook as WebhookTable;
use crate::tables::webhook::Webhook;

#[reducer]
pub fn create_webhook(
    ctx: &ReducerContext,
    uuid: String,
    name: String,
    org_id: String,
    user_id: String,
    url: String,
    event_types: String,
    webhook_type: String,
    app_id: String,
    linked_to: String,
) -> Result<(), String> {
    let now = Timestamp::now();
    ctx.db.webhook().insert(Webhook {
        id: 0,
        uuid,
        name,
        org_id,
        user_id,
        url,
        event_types,
        is_active: true,
        webhook_type,
        app_id,
        linked_to,
        last_triggered_at: String::new(),
        created_at: now,
        updated_at: now,
    });
    Ok(())
}

#[reducer]
pub fn update_webhook(
    ctx: &ReducerContext,
    uuid: String,
    name: String,
    url: String,
    event_types: String,
    is_active: bool,
) -> Result<(), String> {
    let row = ctx
        .db
        .webhook()
        .iter()
        .find(|w| w.uuid == uuid)
        .ok_or_else(|| format!("Webhook '{}' not found", uuid))?;

    let updated = Webhook {
        name,
        url,
        event_types,
        is_active,
        updated_at: Timestamp::now(),
        ..row
    };
    ctx.db.webhook().id().update(updated);
    Ok(())
}

#[reducer]
pub fn delete_webhook(ctx: &ReducerContext, uuid: String) -> Result<(), String> {
    let row = ctx
        .db
        .webhook()
        .iter()
        .find(|w| w.uuid == uuid)
        .ok_or_else(|| format!("Webhook '{}' not found", uuid))?;
    ctx.db.webhook().id().delete(row.id);
    Ok(())
}

#[reducer]
pub fn update_webhook_triggered(ctx: &ReducerContext, uuid: String) -> Result<(), String> {
    let row = ctx
        .db
        .webhook()
        .iter()
        .find(|w| w.uuid == uuid)
        .ok_or_else(|| format!("Webhook '{}' not found", uuid))?;

    let now = Timestamp::now();
    let updated = Webhook {
        last_triggered_at: now.to_micros_since_unix_epoch().to_string(),
        updated_at: now,
        ..row
    };
    ctx.db.webhook().id().update(updated);
    Ok(())
}
