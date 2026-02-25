use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::tables::org_role::org_role as OrgRoleTable;
use crate::tables::org_role::OrgRole;

#[reducer]
pub fn create_role(
    ctx: &ReducerContext,
    uuid: String,
    org_id: String,
    name: String,
    is_admin: bool,
    is_master: bool,
    can_view: bool,
    can_edit: bool,
    have_billing_options: bool,
    have_api_access: bool,
    have_webhook_access: bool,
    have_gpg_access: bool,
    have_cert_access: bool,
    have_audit_access: bool,
    color: String,
) -> Result<(), String> {
    let now = Timestamp::now();
    ctx.db.org_role().insert(OrgRole {
        id: 0,
        uuid,
        org_id,
        name,
        is_admin,
        is_master,
        can_view,
        can_edit,
        have_billing_options,
        have_api_access,
        have_webhook_access,
        have_gpg_access,
        have_cert_access,
        have_audit_access,
        color,
        created_at: now,
        updated_at: now,
    });
    Ok(())
}

/// Create default roles for a new org.
#[reducer]
pub fn create_default_roles(ctx: &ReducerContext, org_id: String, role_uuids_json: String) -> Result<(), String> {
    let uuids: Vec<String> = serde_json::from_str(&role_uuids_json)
        .map_err(|e| format!("Invalid role_uuids JSON: {e}"))?;
    if uuids.len() != 5 {
        return Err("Expected exactly 5 role UUIDs".into());
    }

    let now = Timestamp::now();
    let defaults = vec![
        ("Admin", true, true, true, true, true, true, true, true, true, true, "#EF4444"),
        ("Billing Admin", false, false, true, false, true, false, false, false, false, false, "#F59E0B"),
        ("Manager", false, false, true, true, false, true, true, true, true, true, "#3B82F6"),
        ("Developer", false, false, true, true, false, true, false, false, false, false, "#10B981"),
        ("Viewer", false, false, true, false, false, false, false, false, false, false, "#6B7280"),
    ];

    for (i, (name, is_admin, is_master, can_view, can_edit, have_billing, have_api, have_webhook, have_gpg, have_cert, have_audit, color)) in defaults.into_iter().enumerate() {
        ctx.db.org_role().insert(OrgRole {
            id: 0,
            uuid: uuids[i].clone(),
            org_id: org_id.clone(),
            name: name.to_string(),
            is_admin,
            is_master,
            can_view,
            can_edit,
            have_billing_options: have_billing,
            have_api_access: have_api,
            have_webhook_access: have_webhook,
            have_gpg_access: have_gpg,
            have_cert_access: have_cert,
            have_audit_access: have_audit,
            color: color.to_string(),
            created_at: now,
            updated_at: now,
        });
    }
    Ok(())
}

#[reducer]
pub fn update_role(
    ctx: &ReducerContext,
    uuid: String,
    name: String,
    is_admin: bool,
    is_master: bool,
    can_view: bool,
    can_edit: bool,
    have_billing_options: bool,
    have_api_access: bool,
    have_webhook_access: bool,
    have_gpg_access: bool,
    have_cert_access: bool,
    have_audit_access: bool,
    color: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .org_role()
        .iter()
        .find(|r| r.uuid == uuid)
        .ok_or_else(|| format!("Role '{}' not found", uuid))?;

    let updated = OrgRole {
        name,
        is_admin,
        is_master,
        can_view,
        can_edit,
        have_billing_options,
        have_api_access,
        have_webhook_access,
        have_gpg_access,
        have_cert_access,
        have_audit_access,
        color,
        updated_at: Timestamp::now(),
        ..row
    };
    ctx.db.org_role().id().update(updated);
    Ok(())
}

#[reducer]
pub fn delete_role(ctx: &ReducerContext, uuid: String) -> Result<(), String> {
    let row = ctx
        .db
        .org_role()
        .iter()
        .find(|r| r.uuid == uuid)
        .ok_or_else(|| format!("Role '{}' not found", uuid))?;

    if row.is_master {
        return Err("Cannot delete master role".into());
    }

    ctx.db.org_role().id().delete(row.id);
    Ok(())
}
