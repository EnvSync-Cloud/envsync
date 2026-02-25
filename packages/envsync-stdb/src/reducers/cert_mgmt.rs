use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::tables::org_certificate_meta::org_certificate_meta as OrgCertMetaTable;
use crate::tables::org_certificate_meta::OrgCertificateMeta;

#[reducer]
pub fn create_cert_record(
    ctx: &ReducerContext,
    uuid: String,
    org_id: String,
    user_id: String,
    serial_hex: String,
    cert_type: String,
    subject_cn: String,
    subject_email: String,
    status: String,
    not_before: String,
    not_after: String,
    description: String,
    metadata: String,
) -> Result<(), String> {
    if ctx.db.org_certificate_meta().serial_hex().find(&serial_hex).is_some() {
        return Err(format!("Certificate with serial '{}' already exists", serial_hex));
    }

    let now = Timestamp::now();
    ctx.db.org_certificate_meta().insert(OrgCertificateMeta {
        id: 0,
        uuid,
        org_id,
        user_id,
        serial_hex,
        cert_type,
        subject_cn,
        subject_email,
        status,
        not_before,
        not_after,
        description,
        metadata,
        revoked_at: String::new(),
        revocation_reason: 0,
        created_at: now,
        updated_at: now,
    });
    Ok(())
}

#[reducer]
pub fn update_cert_status(
    ctx: &ReducerContext,
    uuid: String,
    status: String,
    revocation_reason: u32,
) -> Result<(), String> {
    let row = ctx
        .db
        .org_certificate_meta()
        .iter()
        .find(|c| c.uuid == uuid)
        .ok_or_else(|| format!("Certificate '{}' not found", uuid))?;

    let now = Timestamp::now();
    let revoked_at = if status == "revoked" {
        now.to_micros_since_unix_epoch().to_string()
    } else {
        row.revoked_at.clone()
    };

    let updated = OrgCertificateMeta {
        status,
        revoked_at,
        revocation_reason,
        updated_at: now,
        ..row
    };
    ctx.db.org_certificate_meta().id().update(updated);
    Ok(())
}
