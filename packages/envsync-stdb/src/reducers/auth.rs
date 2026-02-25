use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::tables::auth_tuple::auth_tuple as AuthTupleTable;
use crate::tables::auth_tuple::AuthTuple;
use crate::tables::reducer_response::reducer_response as ReducerResponseTable;
use crate::tables::reducer_response::ReducerResponse;
use crate::tables::team_member::team_member as TeamMemberTable;

/// Write authorization tuples in batch.
/// `tuples_json`: JSON array of `[{ "subject", "relation", "object_type", "object_id" }]`
#[reducer]
pub fn write_auth_tuples(
    ctx: &ReducerContext,
    tuples_json: String,
) -> Result<(), String> {
    let tuples: Vec<serde_json::Value> = serde_json::from_str(&tuples_json)
        .map_err(|e| format!("Invalid tuples JSON: {e}"))?;

    let now = Timestamp::now();
    for t in &tuples {
        let subject = t["subject"].as_str().unwrap_or_default().to_string();
        let relation = t["relation"].as_str().unwrap_or_default().to_string();
        let object_type = t["object_type"].as_str().unwrap_or_default().to_string();
        let object_id = t["object_id"].as_str().unwrap_or_default().to_string();

        // Skip if exact tuple already exists
        let exists = ctx
            .db
            .auth_tuple()
            .iter()
            .any(|at| {
                at.subject == subject
                    && at.relation == relation
                    && at.object_type == object_type
                    && at.object_id == object_id
            });
        if exists {
            continue;
        }

        ctx.db.auth_tuple().insert(AuthTuple {
            id: 0,
            subject,
            relation,
            object_type,
            object_id,
            created_at: now,
        });
    }
    Ok(())
}

/// Delete authorization tuples in batch.
/// `tuples_json`: JSON array of `[{ "subject", "relation", "object_type", "object_id" }]`
#[reducer]
pub fn delete_auth_tuples(
    ctx: &ReducerContext,
    tuples_json: String,
) -> Result<(), String> {
    let tuples: Vec<serde_json::Value> = serde_json::from_str(&tuples_json)
        .map_err(|e| format!("Invalid tuples JSON: {e}"))?;

    for t in &tuples {
        let subject = t["subject"].as_str().unwrap_or_default();
        let relation = t["relation"].as_str().unwrap_or_default();
        let object_type = t["object_type"].as_str().unwrap_or_default();
        let object_id = t["object_id"].as_str().unwrap_or_default();

        let ids: Vec<u64> = ctx
            .db
            .auth_tuple()
            .iter()
            .filter(|at| {
                at.subject == subject
                    && at.relation == relation
                    && at.object_type == object_type
                    && at.object_id == object_id
            })
            .map(|at| at.id)
            .collect();

        for id in ids {
            ctx.db.auth_tuple().id().delete(id);
        }
    }
    Ok(())
}

/// Check a single permission with hierarchical resolution.
/// Returns result via reducer_response: `{ "allowed": bool }`
#[reducer]
pub fn check_permission(
    ctx: &ReducerContext,
    request_id: String,
    user_id: String,
    relation: String,
    object_type: String,
    object_id: String,
) -> Result<(), String> {
    let allowed = resolve_permission(ctx, &user_id, &relation, &object_type, &object_id);

    ctx.db.reducer_response().insert(ReducerResponse {
        id: 0,
        request_id,
        data: serde_json::json!({ "allowed": allowed }).to_string(),
        created_at: Timestamp::now(),
    });
    Ok(())
}

/// Batch check permissions.
/// `checks_json`: JSON array of `[{ "relation", "object_type", "object_id" }]`
/// Returns result via reducer_response: JSON array of `{ "key": "relation:object_type:object_id", "allowed": bool }`
#[reducer]
pub fn batch_check(
    ctx: &ReducerContext,
    request_id: String,
    user_id: String,
    checks_json: String,
) -> Result<(), String> {
    let checks: Vec<serde_json::Value> = serde_json::from_str(&checks_json)
        .map_err(|e| format!("Invalid checks JSON: {e}"))?;

    let results: Vec<serde_json::Value> = checks
        .iter()
        .map(|c| {
            let rel = c["relation"].as_str().unwrap_or_default();
            let ot = c["object_type"].as_str().unwrap_or_default();
            let oid = c["object_id"].as_str().unwrap_or_default();
            let allowed = resolve_permission(ctx, &user_id, rel, ot, oid);
            serde_json::json!({
                "key": format!("{}:{}:{}", rel, ot, oid),
                "allowed": allowed,
            })
        })
        .collect();

    ctx.db.reducer_response().insert(ReducerResponse {
        id: 0,
        request_id,
        data: serde_json::to_string(&results).unwrap_or_else(|_| "[]".to_string()),
        created_at: Timestamp::now(),
    });
    Ok(())
}

/// Read tuples matching a filter.
/// All filter fields are optional (empty string = wildcard).
#[reducer]
pub fn read_tuples(
    ctx: &ReducerContext,
    request_id: String,
    subject: String,
    relation: String,
    object_type: String,
    object_id: String,
) -> Result<(), String> {
    let results: Vec<serde_json::Value> = ctx
        .db
        .auth_tuple()
        .iter()
        .filter(|at| {
            (subject.is_empty() || at.subject == subject)
                && (relation.is_empty() || at.relation == relation)
                && (object_type.is_empty() || at.object_type == object_type)
                && (object_id.is_empty() || at.object_id == object_id)
        })
        .map(|at| {
            serde_json::json!({
                "subject": at.subject,
                "relation": at.relation,
                "object_type": at.object_type,
                "object_id": at.object_id,
            })
        })
        .collect();

    ctx.db.reducer_response().insert(ReducerResponse {
        id: 0,
        request_id,
        data: serde_json::to_string(&results).unwrap_or_else(|_| "[]".to_string()),
        created_at: Timestamp::now(),
    });
    Ok(())
}

// ─── Internal permission resolution ────────────────────────────────────────

/// Core permission resolution with hierarchical inheritance.
fn resolve_permission(
    ctx: &ReducerContext,
    user_id: &str,
    relation: &str,
    object_type: &str,
    object_id: &str,
) -> bool {
    let subject = format!("user:{}", user_id);

    // 1. Direct tuple check
    if has_tuple(ctx, &subject, relation, object_type, object_id) {
        return true;
    }

    // 2. Check computed relations (higher implies lower)
    let implied_by = get_implied_relations(relation, object_type);
    for implied in &implied_by {
        if has_tuple(ctx, &subject, implied, object_type, object_id) {
            return true;
        }
    }

    // 3. Team membership expansion
    // Find all teams the user belongs to
    let team_ids: Vec<String> = ctx
        .db
        .team_member()
        .user_id()
        .filter(&user_id.to_string())
        .map(|m| m.team_id.clone())
        .collect();

    for team_id in &team_ids {
        let team_subject = format!("team:{}#member", team_id);
        if has_tuple(ctx, &team_subject, relation, object_type, object_id) {
            return true;
        }
        for implied in &implied_by {
            if has_tuple(ctx, &team_subject, implied, object_type, object_id) {
                return true;
            }
        }
    }

    // 4. Structural inheritance: check parent objects
    match object_type {
        "app" => {
            // app inherits from org
            if let Some(org_id) = get_parent_org(ctx, "app", object_id) {
                if resolve_permission(ctx, user_id, relation, "org", &org_id) {
                    return true;
                }
                // Org-level admin/master implies app-level access
                if relation == "can_view" || relation == "viewer" {
                    if resolve_permission(ctx, user_id, "can_view", "org", &org_id) {
                        return true;
                    }
                }
                if relation == "can_edit" || relation == "editor" {
                    if resolve_permission(ctx, user_id, "can_edit", "org", &org_id) {
                        return true;
                    }
                }
            }
        }
        "env_type" => {
            // env_type inherits from app and org
            if let Some(app_id) = get_parent(ctx, "env_type", object_id, "app") {
                if resolve_permission(ctx, user_id, relation, "app", &app_id) {
                    return true;
                }
            }
            if let Some(org_id) = get_parent_org(ctx, "env_type", object_id) {
                if resolve_permission(ctx, user_id, relation, "org", &org_id) {
                    return true;
                }
            }
        }
        "gpg_key" | "certificate" => {
            // Inherits from org
            if let Some(org_id) = get_parent_org(ctx, object_type, object_id) {
                if resolve_permission(ctx, user_id, relation, "org", &org_id) {
                    return true;
                }
            }
        }
        "team" => {
            // Team inherits from org
            if let Some(org_id) = get_parent_org(ctx, "team", object_id) {
                if resolve_permission(ctx, user_id, relation, "org", &org_id) {
                    return true;
                }
            }
        }
        _ => {}
    }

    false
}

/// Check if an exact tuple exists.
fn has_tuple(
    ctx: &ReducerContext,
    subject: &str,
    relation: &str,
    object_type: &str,
    object_id: &str,
) -> bool {
    ctx.db
        .auth_tuple()
        .subject()
        .filter(&subject.to_string())
        .any(|at| {
            at.relation == relation && at.object_type == object_type && at.object_id == object_id
        })
}

/// Get relations that imply the given relation for a given object type.
fn get_implied_relations(relation: &str, object_type: &str) -> Vec<&'static str> {
    match object_type {
        "org" => match relation {
            "can_view" => vec!["admin", "master", "member"],
            "can_edit" => vec!["admin", "master"],
            "member" => vec!["admin", "master"],
            "admin" => vec!["master"],
            "have_billing_options" => vec!["admin", "master"],
            "have_api_access" => vec!["admin", "master"],
            "have_webhook_access" => vec!["admin", "master"],
            "have_gpg_access" => vec!["admin", "master"],
            "have_cert_access" => vec!["admin", "master"],
            "have_audit_access" => vec!["admin", "master"],
            "can_manage_roles" => vec!["admin", "master"],
            "can_manage_teams" => vec!["admin", "master"],
            "can_manage_invites" => vec!["admin", "master"],
            "can_manage_org" => vec!["master"],
            _ => vec![],
        },
        "app" => match relation {
            "can_view" => vec!["admin", "editor", "viewer"],
            "can_edit" => vec!["admin", "editor"],
            "can_manage" => vec!["admin"],
            "viewer" => vec!["editor", "admin"],
            "editor" => vec!["admin"],
            _ => vec![],
        },
        "env_type" => match relation {
            "can_view" => vec!["admin", "editor", "viewer"],
            "can_edit" => vec!["admin", "editor"],
            "can_manage_protected" => vec!["admin"],
            "viewer" => vec!["editor", "admin"],
            "editor" => vec!["admin"],
            _ => vec![],
        },
        "gpg_key" => match relation {
            "can_view" => vec!["owner", "manager", "signer"],
            "can_sign" => vec!["owner", "manager", "signer"],
            "can_manage" => vec!["owner", "manager"],
            _ => vec![],
        },
        "certificate" => match relation {
            "can_view" => vec!["owner", "manager", "viewer"],
            "can_manage" => vec!["owner", "manager"],
            "can_revoke" => vec!["owner", "manager"],
            _ => vec![],
        },
        "team" => match relation {
            "member" => vec![],
            _ => vec![],
        },
        _ => vec![],
    }
}

/// Find the parent org of a resource via structural tuples.
fn get_parent_org(ctx: &ReducerContext, object_type: &str, object_id: &str) -> Option<String> {
    get_parent(ctx, object_type, object_id, "org")
}

/// Find a parent of a resource via structural tuples.
fn get_parent(
    ctx: &ReducerContext,
    object_type: &str,
    object_id: &str,
    parent_relation: &str,
) -> Option<String> {
    ctx.db
        .auth_tuple()
        .object_id()
        .filter(&object_id.to_string())
        .find(|at| at.object_type == object_type && at.relation == parent_relation)
        .map(|at| {
            // subject is "org:<id>" or "app:<id>" — extract the ID
            at.subject
                .split(':')
                .nth(1)
                .unwrap_or_default()
                .to_string()
        })
}
