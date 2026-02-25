use spacetimedb::{table, Timestamp};

/// Organization certificate metadata — replaces PostgreSQL `org_certificates` table.
/// Actual certificate DER and encrypted private key are in `pki_certificate` table.
#[table(public, accessor = org_certificate_meta)]
pub struct OrgCertificateMeta {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// UUID string used as external identifier
    pub uuid: String,
    #[index(btree)]
    pub org_id: String,
    pub user_id: String,
    #[unique]
    pub serial_hex: String,
    pub cert_type: String,
    pub subject_cn: String,
    pub subject_email: String,
    pub status: String,
    pub not_before: String,
    pub not_after: String,
    pub description: String,
    /// JSON-serialized metadata
    pub metadata: String,
    pub revoked_at: String,
    pub revocation_reason: u32,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}
