use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::tables::gpg_key_meta::gpg_key_meta as GpgKeyMetaTable;
use crate::tables::gpg_key_meta::GpgKeyMeta;

#[reducer]
pub fn create_gpg_key_record(
    ctx: &ReducerContext,
    uuid: String,
    org_id: String,
    user_id: String,
    name: String,
    email: String,
    fingerprint: String,
    key_id: String,
    algorithm: String,
    key_size: u32,
    public_key: String,
    private_key_ref: String,
    usage_flags: String,
    trust_level: String,
    expires_at: String,
    is_default: bool,
) -> Result<(), String> {
    if ctx.db.gpg_key_meta().fingerprint().find(&fingerprint).is_some() {
        return Err(format!("GPG key with fingerprint '{}' already exists", fingerprint));
    }

    let now = Timestamp::now();
    ctx.db.gpg_key_meta().insert(GpgKeyMeta {
        id: 0,
        uuid,
        org_id,
        user_id,
        name,
        email,
        fingerprint,
        key_id,
        algorithm,
        key_size,
        public_key,
        private_key_ref,
        usage_flags,
        trust_level,
        expires_at,
        revoked_at: String::new(),
        revocation_reason: String::new(),
        is_default,
        created_at: now,
        updated_at: now,
    });
    Ok(())
}

#[reducer]
pub fn revoke_gpg_key(
    ctx: &ReducerContext,
    uuid: String,
    revocation_reason: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .gpg_key_meta()
        .iter()
        .find(|k| k.uuid == uuid)
        .ok_or_else(|| format!("GPG key '{}' not found", uuid))?;

    let now = Timestamp::now();
    let updated = GpgKeyMeta {
        revoked_at: now.to_micros_since_unix_epoch().to_string(),
        revocation_reason,
        updated_at: now,
        ..row
    };
    ctx.db.gpg_key_meta().id().update(updated);
    Ok(())
}

#[reducer]
pub fn update_gpg_trust(
    ctx: &ReducerContext,
    uuid: String,
    trust_level: String,
) -> Result<(), String> {
    let row = ctx
        .db
        .gpg_key_meta()
        .iter()
        .find(|k| k.uuid == uuid)
        .ok_or_else(|| format!("GPG key '{}' not found", uuid))?;

    let updated = GpgKeyMeta {
        trust_level,
        updated_at: Timestamp::now(),
        ..row
    };
    ctx.db.gpg_key_meta().id().update(updated);
    Ok(())
}

#[reducer]
pub fn delete_gpg_key_record(ctx: &ReducerContext, uuid: String) -> Result<(), String> {
    let row = ctx
        .db
        .gpg_key_meta()
        .iter()
        .find(|k| k.uuid == uuid)
        .ok_or_else(|| format!("GPG key '{}' not found", uuid))?;
    ctx.db.gpg_key_meta().id().delete(row.id);
    Ok(())
}
