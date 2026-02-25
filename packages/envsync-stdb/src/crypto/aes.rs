use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use spacetimedb::ReducerContext;

use super::rng::random_bytes;

/// AES-256-GCM encrypt with Additional Authenticated Data (AAD).
/// Returns (ciphertext_b64, nonce_b64).
pub fn encrypt(
    ctx: &ReducerContext,
    key: &[u8; 32],
    plaintext: &[u8],
    aad: &str,
) -> Result<(String, String), String> {
    let nonce_bytes = random_bytes(ctx, 12);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| format!("AES init: {e}"))?;

    let payload = Payload {
        msg: plaintext,
        aad: aad.as_bytes(),
    };

    let ciphertext = cipher.encrypt(nonce, payload).map_err(|e| format!("AES encrypt: {e}"))?;

    Ok((B64.encode(&ciphertext), B64.encode(&nonce_bytes)))
}

/// AES-256-GCM decrypt with AAD verification.
pub fn decrypt(
    key: &[u8; 32],
    ciphertext_b64: &str,
    nonce_b64: &str,
    aad: &str,
) -> Result<Vec<u8>, String> {
    let ciphertext = B64.decode(ciphertext_b64).map_err(|e| format!("b64 ct: {e}"))?;
    let nonce_bytes = B64.decode(nonce_b64).map_err(|e| format!("b64 nonce: {e}"))?;

    if nonce_bytes.len() != 12 {
        return Err("Invalid nonce length".into());
    }

    let nonce = Nonce::from_slice(&nonce_bytes);
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| format!("AES init: {e}"))?;

    let payload = Payload {
        msg: ciphertext.as_ref(),
        aad: aad.as_bytes(),
    };

    cipher.decrypt(nonce, payload).map_err(|e| format!("AES decrypt: {e}"))
}
