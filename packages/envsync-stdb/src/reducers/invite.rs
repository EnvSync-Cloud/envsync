use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::tables::invite_org::invite_org as InviteOrgTable;
use crate::tables::invite_org::InviteOrg;
use crate::tables::invite_user::invite_user as InviteUserTable;
use crate::tables::invite_user::InviteUser;

#[reducer]
pub fn create_org_invite(
    ctx: &ReducerContext,
    uuid: String,
    email: String,
    invite_token: String,
) -> Result<(), String> {
    let now = Timestamp::now();
    ctx.db.invite_org().insert(InviteOrg {
        id: 0,
        uuid,
        email,
        invite_token,
        is_accepted: false,
        created_at: now,
        updated_at: now,
    });
    Ok(())
}

#[reducer]
pub fn accept_org_invite(ctx: &ReducerContext, invite_token: String) -> Result<(), String> {
    let row = ctx
        .db
        .invite_org()
        .invite_token()
        .find(&invite_token)
        .ok_or_else(|| "Org invite not found".to_string())?;

    if row.is_accepted {
        return Err("Invite already accepted".into());
    }

    let updated = InviteOrg {
        is_accepted: true,
        updated_at: Timestamp::now(),
        ..row
    };
    ctx.db.invite_org().id().update(updated);
    Ok(())
}

#[reducer]
pub fn create_user_invite(
    ctx: &ReducerContext,
    uuid: String,
    email: String,
    role_id: String,
    invite_token: String,
    org_id: String,
) -> Result<(), String> {
    let now = Timestamp::now();
    ctx.db.invite_user().insert(InviteUser {
        id: 0,
        uuid,
        email,
        role_id,
        invite_token,
        is_accepted: false,
        org_id,
        created_at: now,
        updated_at: now,
    });
    Ok(())
}

#[reducer]
pub fn accept_user_invite(ctx: &ReducerContext, invite_token: String) -> Result<(), String> {
    let row = ctx
        .db
        .invite_user()
        .iter()
        .find(|i| i.invite_token == invite_token)
        .ok_or_else(|| "User invite not found".to_string())?;

    if row.is_accepted {
        return Err("Invite already accepted".into());
    }

    let updated = InviteUser {
        is_accepted: true,
        updated_at: Timestamp::now(),
        ..row
    };
    ctx.db.invite_user().id().update(updated);
    Ok(())
}

#[reducer]
pub fn delete_org_invite(ctx: &ReducerContext, uuid: String) -> Result<(), String> {
    let row = ctx
        .db
        .invite_org()
        .iter()
        .find(|i| i.uuid == uuid)
        .ok_or_else(|| format!("Org invite '{}' not found", uuid))?;

    ctx.db.invite_org().id().delete(row.id);
    Ok(())
}

#[reducer]
pub fn delete_user_invite(ctx: &ReducerContext, uuid: String) -> Result<(), String> {
    let row = ctx
        .db
        .invite_user()
        .iter()
        .find(|i| i.uuid == uuid)
        .ok_or_else(|| format!("User invite '{}' not found", uuid))?;

    ctx.db.invite_user().id().delete(row.id);
    Ok(())
}

#[reducer]
pub fn update_org_invite(
    ctx: &ReducerContext,
    uuid: String,
    is_accepted: bool,
) -> Result<(), String> {
    let row = ctx
        .db
        .invite_org()
        .iter()
        .find(|i| i.uuid == uuid)
        .ok_or_else(|| format!("Org invite '{}' not found", uuid))?;

    let updated = InviteOrg {
        is_accepted,
        updated_at: Timestamp::now(),
        ..row
    };
    ctx.db.invite_org().id().update(updated);
    Ok(())
}

#[reducer]
pub fn update_user_invite(
    ctx: &ReducerContext,
    uuid: String,
    is_accepted: bool,
    role_id: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .invite_user()
        .iter()
        .find(|i| i.uuid == uuid)
        .ok_or_else(|| format!("User invite '{}' not found", uuid))?;

    let updated = InviteUser {
        is_accepted,
        role_id,
        updated_at: Timestamp::now(),
        ..row
    };
    ctx.db.invite_user().id().update(updated);
    Ok(())
}
