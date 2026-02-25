use base64::{engine::general_purpose::STANDARD as B64, Engine};
use spacetimedb::{reducer, ReducerContext, Table, Timestamp};

use crate::crypto::aes;
use crate::pki::{ca, cert, crl, ocsp};
use crate::reducers::key_mgmt::get_or_create_dek;
use crate::tables::crl_entry::crl_entry as CrlEntryTable;
use crate::tables::crl_entry::CrlEntry;
use crate::tables::pki_certificate::pki_certificate as PkiCertTable;
use crate::tables::pki_certificate::PkiCertificate;
use crate::tables::reducer_response::reducer_response as ReducerResponseTable;
use crate::tables::reducer_response::ReducerResponse;
use crate::tables::sequences::sequence as SequenceTable;

fn next_serial(ctx: &ReducerContext) -> Result<u64, String> {
    let seq = ctx
        .db
        .sequence()
        .name()
        .find("cert_serial".to_string())
        .ok_or("cert_serial sequence not found — call init first")?;

    let val = seq.value;
    ctx.db.sequence().name().delete("cert_serial".to_string());
    ctx.db.sequence().insert(crate::tables::sequences::Sequence {
        name: "cert_serial".to_string(),
        value: val + 1,
    });
    Ok(val)
}

fn next_crl_number(ctx: &ReducerContext) -> Result<u64, String> {
    let seq = ctx
        .db
        .sequence()
        .name()
        .find("crl_number".to_string())
        .ok_or("crl_number sequence not found — call init first")?;

    let val = seq.value;
    ctx.db.sequence().name().delete("crl_number".to_string());
    ctx.db.sequence().insert(crate::tables::sequences::Sequence {
        name: "crl_number".to_string(),
        value: val + 1,
    });
    Ok(val)
}

/// Create an intermediate Org CA. Writes JSON result to reducer_response.
#[reducer]
pub fn create_org_ca(
    ctx: &ReducerContext,
    request_id: String,
    root_key_hex: String,
    org_id: String,
    org_name: String,
) -> Result<(), String> {
    // Check if org CA already exists
    let exists = ctx
        .db
        .pki_certificate()
        .iter()
        .any(|c| c.org_id == org_id && c.cert_type == "org_ca" && c.status == "active");
    if exists {
        return Err("Org CA already exists".into());
    }

    // Get root CA
    let root_ca = ctx
        .db
        .pki_certificate()
        .iter()
        .find(|c| c.cert_type == "root_ca" && c.status == "active")
        .ok_or("Root CA not found — call init first")?;

    // Decrypt root CA private key
    let scope_id = "pki".to_string();
    let dek = crate::reducers::key_mgmt::get_dek_at_version(
        ctx,
        &root_key_hex,
        &root_ca.org_id,
        &scope_id,
        root_ca.key_version,
    )?;
    let root_priv_bytes = aes::decrypt(
        &dek,
        &root_ca.encrypted_private_key,
        &root_ca.private_key_nonce,
        "pki:root_ca:private_key",
    )?;

    // Generate org CA keypair
    let (org_priv_der, org_pub_der) = ca::generate_rsa_keypair(ctx)?;

    let serial = next_serial(ctx)?;
    let cert_der = ca::create_org_ca(&root_priv_bytes, &org_pub_der, &org_name, serial)?;

    // Encrypt org CA private key
    let (dek, version) = get_or_create_dek(ctx, &root_key_hex, &org_id, &scope_id)?;
    let (encrypted_pk, pk_nonce) =
        aes::encrypt(ctx, &dek, &org_priv_der, &format!("pki:{org_id}:org_ca:private_key"))?;

    let serial_hex = format!("{serial:016x}");
    let cert_b64 = B64.encode(&cert_der);

    ctx.db.pki_certificate().insert(PkiCertificate {
        id: 0,
        org_id: org_id.clone(),
        cert_type: "org_ca".to_string(),
        serial_hex: serial_hex.clone(),
        subject_cn: format!("{org_name} CA"),
        cert_der: cert_b64.clone(),
        encrypted_private_key: encrypted_pk,
        private_key_nonce: pk_nonce,
        key_version: version,
        status: "active".to_string(),
        created_at: Timestamp::now(),
    });

    // Convert DER to PEM
    let cert_pem = der_to_pem(&cert_der, "CERTIFICATE");

    let data = serde_json::json!({
        "cert_pem": cert_pem,
        "serial_hex": serial_hex,
    })
    .to_string();

    ctx.db.reducer_response().insert(ReducerResponse {
        id: 0,
        request_id,
        data,
        created_at: Timestamp::now(),
    });

    Ok(())
}

/// Issue a member certificate signed by the org CA. Writes result to reducer_response.
#[reducer]
pub fn issue_member_cert(
    ctx: &ReducerContext,
    request_id: String,
    root_key_hex: String,
    _user_id: String,
    member_email: String,
    org_id: String,
    _role: String,
) -> Result<(), String> {
    // Find org CA
    let org_ca = ctx
        .db
        .pki_certificate()
        .iter()
        .find(|c| c.org_id == org_id && c.cert_type == "org_ca" && c.status == "active")
        .ok_or("Org CA not found")?;

    // Decrypt org CA private key
    let scope_id = "pki".to_string();
    let dek = crate::reducers::key_mgmt::get_dek_at_version(
        ctx,
        &root_key_hex,
        &org_id,
        &scope_id,
        org_ca.key_version,
    )?;
    let ca_priv_bytes = aes::decrypt(
        &dek,
        &org_ca.encrypted_private_key,
        &org_ca.private_key_nonce,
        &format!("pki:{org_id}:org_ca:private_key"),
    )?;

    // Generate member keypair
    let (member_priv_der, member_pub_der) = ca::generate_rsa_keypair(ctx)?;

    let serial = next_serial(ctx)?;
    let org_name = org_ca.subject_cn.replace(" CA", "");
    let cert_der = cert::issue_member_cert(&ca_priv_bytes, &member_pub_der, &member_email, &org_name, serial)?;

    // Encrypt member private key
    let (dek, version) = get_or_create_dek(ctx, &root_key_hex, &org_id, &scope_id)?;
    let (encrypted_pk, pk_nonce) = aes::encrypt(
        ctx,
        &dek,
        &member_priv_der,
        &format!("pki:{org_id}:member:{member_email}:private_key"),
    )?;

    let serial_hex = format!("{serial:016x}");
    let cert_b64 = B64.encode(&cert_der);

    ctx.db.pki_certificate().insert(PkiCertificate {
        id: 0,
        org_id: org_id.clone(),
        cert_type: "member".to_string(),
        serial_hex: serial_hex.clone(),
        subject_cn: member_email.clone(),
        cert_der: cert_b64,
        encrypted_private_key: encrypted_pk,
        private_key_nonce: pk_nonce,
        key_version: version,
        status: "active".to_string(),
        created_at: Timestamp::now(),
    });

    let cert_pem = der_to_pem(&cert_der, "CERTIFICATE");
    let key_pem = der_to_pem(&member_priv_der, "PRIVATE KEY");

    let data = serde_json::json!({
        "cert_pem": cert_pem,
        "key_pem": key_pem,
        "serial_hex": serial_hex,
    })
    .to_string();

    ctx.db.reducer_response().insert(ReducerResponse {
        id: 0,
        request_id,
        data,
        created_at: Timestamp::now(),
    });

    Ok(())
}

/// Revoke a certificate.
#[reducer]
pub fn revoke_cert(
    ctx: &ReducerContext,
    serial_hex: String,
    org_id: String,
    reason: u32,
) -> Result<(), String> {
    let cert = ctx
        .db
        .pki_certificate()
        .iter()
        .find(|c| c.serial_hex == serial_hex && c.org_id == org_id)
        .ok_or("Certificate not found")?;

    let cert_id = cert.id;
    let mut updated = cert.clone();
    updated.status = "revoked".to_string();
    ctx.db.pki_certificate().id().delete(cert_id);
    ctx.db.pki_certificate().insert(updated);

    // Add CRL entry
    ctx.db.crl_entry().insert(CrlEntry {
        id: 0,
        org_id,
        serial_hex,
        reason,
        revoked_at: Timestamp::now(),
    });

    Ok(())
}

/// Get CRL for an org. Writes result to reducer_response.
#[reducer]
pub fn get_crl(
    ctx: &ReducerContext,
    request_id: String,
    org_id: String,
    delta_only: bool,
) -> Result<(), String> {
    let crl_number = next_crl_number(ctx)?;

    let entries: Vec<crl::RevokedEntry> = ctx
        .db
        .crl_entry()
        .iter()
        .filter(|e| e.org_id == org_id)
        .map(|e| crl::RevokedEntry {
            serial_hex: e.serial_hex.clone(),
            reason: e.reason,
            revoked_at: e.revoked_at.to_micros_since_unix_epoch().to_string(),
        })
        .collect();

    let data = crl::build_crl_json(&org_id, crl_number, delta_only, entries);

    ctx.db.reducer_response().insert(ReducerResponse {
        id: 0,
        request_id,
        data,
        created_at: Timestamp::now(),
    });

    Ok(())
}

/// Check OCSP status for a certificate. Writes result to reducer_response.
#[reducer]
pub fn check_ocsp(
    ctx: &ReducerContext,
    request_id: String,
    serial_hex: String,
    org_id: String,
) -> Result<(), String> {
    let entries: Vec<(String, u64)> = ctx
        .db
        .crl_entry()
        .iter()
        .filter(|e| e.org_id == org_id)
        .map(|e| (e.serial_hex.clone(), e.revoked_at.to_micros_since_unix_epoch() as u64))
        .collect();

    let (status, revoked_at) = ocsp::check_status(&serial_hex, &entries);

    let data = serde_json::json!({
        "status": status,
        "revoked_at": revoked_at,
    })
    .to_string();

    ctx.db.reducer_response().insert(ReducerResponse {
        id: 0,
        request_id,
        data,
        created_at: Timestamp::now(),
    });

    Ok(())
}

/// Get root CA certificate PEM. Writes result to reducer_response.
#[reducer]
pub fn get_root_ca(
    ctx: &ReducerContext,
    request_id: String,
) -> Result<(), String> {
    let root = ctx
        .db
        .pki_certificate()
        .iter()
        .find(|c| c.cert_type == "root_ca" && c.status == "active")
        .ok_or("Root CA not found")?;

    let cert_bytes = B64.decode(&root.cert_der).map_err(|e| format!("b64: {e}"))?;
    let cert_pem = der_to_pem(&cert_bytes, "CERTIFICATE");

    let data = serde_json::json!({
        "cert_pem": cert_pem,
    })
    .to_string();

    ctx.db.reducer_response().insert(ReducerResponse {
        id: 0,
        request_id,
        data,
        created_at: Timestamp::now(),
    });

    Ok(())
}

fn der_to_pem(der: &[u8], label: &str) -> String {
    let b64 = B64.encode(der);
    let mut pem = format!("-----BEGIN {label}-----\n");
    for chunk in b64.as_bytes().chunks(64) {
        pem.push_str(core::str::from_utf8(chunk).unwrap_or(""));
        pem.push('\n');
    }
    pem.push_str(&format!("-----END {label}-----"));
    pem
}
