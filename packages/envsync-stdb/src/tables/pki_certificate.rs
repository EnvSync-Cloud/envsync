use spacetimedb::{table, Timestamp};

/// PKI certificate — Root CA, Org CA, Member certs.
#[table(public, accessor = pki_certificate)]
#[derive(Clone)]
pub struct PkiCertificate {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[index(btree)]
    pub org_id: String,
    /// "root_ca", "org_ca", "member"
    pub cert_type: String,
    pub serial_hex: String,
    pub subject_cn: String,
    /// DER-encoded certificate (base64)
    pub cert_der: String,
    /// AES-256-GCM encrypted private key DER (base64)
    pub encrypted_private_key: String,
    pub private_key_nonce: String,
    /// Key version used for private key encryption
    pub key_version: u32,
    pub status: String,
    pub created_at: Timestamp,
}
