use hkdf::Hkdf;
use sha2::Sha256;

/// Derive a 32-byte KEK from the root key using HKDF-SHA256.
pub fn derive_kek(root_key: &[u8], info: &str) -> Result<[u8; 32], String> {
    let hk = Hkdf::<Sha256>::new(None, root_key);
    let mut okm = [0u8; 32];
    hk.expand(info.as_bytes(), &mut okm)
        .map_err(|e| format!("HKDF expand: {e}"))?;
    Ok(okm)
}

/// Derive a scope-specific DEK encryption key from the KEK.
pub fn derive_scope_key(kek: &[u8; 32], org_id: &str, scope_id: &str) -> Result<[u8; 32], String> {
    let info = format!("envsync:dek:{org_id}:{scope_id}");
    let hk = Hkdf::<Sha256>::new(None, kek);
    let mut okm = [0u8; 32];
    hk.expand(info.as_bytes(), &mut okm)
        .map_err(|e| format!("HKDF scope: {e}"))?;
    Ok(okm)
}

/// Compute SHA-256 hash of key material (for verification, not storage of actual key).
pub fn hash_key(key: &[u8]) -> String {
    use sha2::Digest;
    let mut hasher = Sha256::new();
    hasher.update(key);
    hex::encode(hasher.finalize())
}
