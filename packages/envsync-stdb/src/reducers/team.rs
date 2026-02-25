use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::tables::auth_tuple::auth_tuple as AuthTupleTable;
use crate::tables::auth_tuple::AuthTuple;
use crate::tables::team::team as TeamTable;
use crate::tables::team::Team;
use crate::tables::team_member::team_member as TeamMemberTable;
use crate::tables::team_member::TeamMember;

#[reducer]
pub fn create_team(
    ctx: &ReducerContext,
    uuid: String,
    org_id: String,
    name: String,
    description: String,
    color: String,
) -> Result<(), String> {
    let now = Timestamp::now();
    ctx.db.team().insert(Team {
        id: 0,
        uuid,
        org_id,
        name,
        description,
        color,
        created_at: now,
        updated_at: now,
    });
    Ok(())
}

#[reducer]
pub fn update_team(
    ctx: &ReducerContext,
    uuid: String,
    name: String,
    description: String,
    color: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .team()
        .iter()
        .find(|t| t.uuid == uuid)
        .ok_or_else(|| format!("Team '{}' not found", uuid))?;

    let updated = Team {
        name,
        description,
        color,
        updated_at: Timestamp::now(),
        ..row
    };
    ctx.db.team().id().update(updated);
    Ok(())
}

#[reducer]
pub fn delete_team(ctx: &ReducerContext, uuid: String) -> Result<(), String> {
    let row = ctx
        .db
        .team()
        .iter()
        .find(|t| t.uuid == uuid)
        .ok_or_else(|| format!("Team '{}' not found", uuid))?;

    // Delete all members first
    let member_ids: Vec<u64> = ctx
        .db
        .team_member()
        .team_id()
        .filter(&uuid)
        .map(|m| m.id)
        .collect();
    for mid in member_ids {
        ctx.db.team_member().id().delete(mid);
    }

    ctx.db.team().id().delete(row.id);
    Ok(())
}

#[reducer]
pub fn add_team_member(
    ctx: &ReducerContext,
    uuid: String,
    team_id: String,
    user_id: String,
) -> Result<(), String> {
    // Check duplicate
    let exists = ctx
        .db
        .team_member()
        .team_id()
        .filter(&team_id)
        .any(|m| m.user_id == user_id);
    if exists {
        return Err("User is already a member of this team".into());
    }

    ctx.db.team_member().insert(TeamMember {
        id: 0,
        uuid,
        team_id,
        user_id,
        created_at: Timestamp::now(),
    });
    Ok(())
}

#[reducer]
pub fn remove_team_member(
    ctx: &ReducerContext,
    team_id: String,
    user_id: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .team_member()
        .team_id()
        .filter(&team_id)
        .find(|m| m.user_id == user_id)
        .ok_or_else(|| "Team member not found".to_string())?;

    ctx.db.team_member().id().delete(row.id);
    Ok(())
}

/// Atomic: create team + write auth tuple (replaces saga)
#[reducer]
pub fn create_team_with_auth(
    ctx: &ReducerContext,
    uuid: String,
    org_id: String,
    name: String,
    description: String,
    color: String,
) -> Result<(), String> {
    let now = Timestamp::now();
    ctx.db.team().insert(Team {
        id: 0,
        uuid: uuid.clone(),
        org_id: org_id.clone(),
        name,
        description,
        color,
        created_at: now,
        updated_at: now,
    });

    // Write team→org structural tuple
    ctx.db.auth_tuple().insert(AuthTuple {
        id: 0,
        subject: format!("org:{}", org_id),
        relation: "org".to_string(),
        object_type: "team".to_string(),
        object_id: uuid,
        created_at: now,
    });

    Ok(())
}
