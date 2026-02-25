use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::tables::user_settings::user_settings as UserSettingsTable;
use crate::tables::user_settings::UserSettings;

#[reducer]
pub fn create_settings(
    ctx: &ReducerContext,
    uuid: String,
    user_id: String,
    email_notifications: bool,
    theme: String,
) -> Result<(), String> {
    if ctx.db.user_settings().user_id().find(&user_id).is_some() {
        return Err(format!("Settings for user '{}' already exist", user_id));
    }

    let now = Timestamp::now();
    ctx.db.user_settings().insert(UserSettings {
        id: 0,
        uuid,
        user_id,
        email_notifications,
        theme,
        created_at: now,
        updated_at: now,
    });
    Ok(())
}

#[reducer]
pub fn update_settings(
    ctx: &ReducerContext,
    user_id: String,
    email_notifications: bool,
    theme: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .user_settings()
        .user_id()
        .find(&user_id)
        .ok_or_else(|| format!("Settings for user '{}' not found", user_id))?;

    let updated = UserSettings {
        email_notifications,
        theme,
        updated_at: Timestamp::now(),
        ..row
    };
    ctx.db.user_settings().id().update(updated);
    Ok(())
}

#[reducer]
pub fn delete_settings(ctx: &ReducerContext, user_id: String) -> Result<(), String> {
    let row = ctx
        .db
        .user_settings()
        .user_id()
        .find(&user_id)
        .ok_or_else(|| format!("Settings for user '{}' not found", user_id))?;

    ctx.db.user_settings().id().delete(row.id);
    Ok(())
}
