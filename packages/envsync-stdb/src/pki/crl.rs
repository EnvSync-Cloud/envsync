/// CRL building — produces DER-encoded CRL for an org.
/// This is a simplified implementation that returns revoked serial numbers.
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct CrlInfo {
    pub org_id: String,
    pub crl_number: u64,
    pub is_delta: bool,
    pub revoked_serials: Vec<RevokedEntry>,
}

#[derive(Serialize, Deserialize)]
pub struct RevokedEntry {
    pub serial_hex: String,
    pub reason: u32,
    pub revoked_at: String,
}

/// Build a JSON-serialized CRL from revocation entries.
/// Full DER CRL building requires the CA private key and is done on-demand.
pub fn build_crl_json(
    org_id: &str,
    crl_number: u64,
    is_delta: bool,
    entries: Vec<RevokedEntry>,
) -> String {
    let crl = CrlInfo {
        org_id: org_id.to_string(),
        crl_number,
        is_delta,
        revoked_serials: entries,
    };
    serde_json::to_string(&crl).unwrap_or_default()
}
