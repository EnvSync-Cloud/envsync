use der::Encode;
use rsa::pkcs1v15::SigningKey;
use rsa::{RsaPrivateKey, RsaPublicKey};
use sha2::Sha256;
use spacetimedb::ReducerContext;
use x509_cert::builder::{Builder, CertificateBuilder, Profile};
use x509_cert::name::Name;
use x509_cert::serial_number::SerialNumber;
use x509_cert::spki::SubjectPublicKeyInfoOwned;
use x509_cert::time::Validity;

use crate::crypto::rng::seeded_std_rng;

use core::str::FromStr;

/// Generate an RSA-3072 key pair using SpaceTimeDB's RNG.
/// Returns (private_key_der_bytes, public_key_der_bytes).
pub fn generate_rsa_keypair(ctx: &ReducerContext) -> Result<(Vec<u8>, Vec<u8>), String> {
    let mut rng = seeded_std_rng(ctx);
    let bits = 3072;
    let private_key =
        RsaPrivateKey::new(&mut rng, bits).map_err(|e| format!("RSA keygen: {e}"))?;
    let public_key = RsaPublicKey::from(&private_key);

    let priv_der = rsa::pkcs8::EncodePrivateKey::to_pkcs8_der(&private_key)
        .map_err(|e| format!("priv DER: {e}"))?;
    let pub_der = rsa::pkcs8::EncodePublicKey::to_public_key_der(&public_key)
        .map_err(|e| format!("pub DER: {e}"))?;

    Ok((priv_der.as_bytes().to_vec(), pub_der.as_ref().to_vec()))
}

/// Self-sign a root CA certificate.
pub fn create_root_ca(
    private_key_der: &[u8],
    serial: u64,
) -> Result<Vec<u8>, String> {
    let private_key: RsaPrivateKey =
        rsa::pkcs8::DecodePrivateKey::from_pkcs8_der(private_key_der)
            .map_err(|e| format!("decode priv: {e}"))?;
    let public_key = RsaPublicKey::from(&private_key);

    let pub_der = rsa::pkcs8::EncodePublicKey::to_public_key_der(&public_key)
        .map_err(|e| format!("pub DER: {e}"))?;
    let spki = SubjectPublicKeyInfoOwned::try_from(pub_der.as_ref())
        .map_err(|e| format!("SPKI: {e}"))?;

    let serial_bytes = serial.to_be_bytes();
    let sn = SerialNumber::new(&serial_bytes).map_err(|e| format!("serial: {e}"))?;
    let subject = Name::from_str("CN=EnvSync Root CA")
        .map_err(|e| format!("name: {e}"))?;
    let validity = Validity::from_now(core::time::Duration::from_secs(10 * 365 * 86400))
        .map_err(|e| format!("validity: {e}"))?;

    let signer: SigningKey<Sha256> = SigningKey::new(private_key);

    let builder = CertificateBuilder::new(
        Profile::Root,
        sn,
        validity,
        subject,
        spki,
        &signer,
    )
    .map_err(|e| format!("builder: {e}"))?;

    let cert = builder.build().map_err(|e| format!("build cert: {e}"))?;
    let cert_der = cert.to_der().map_err(|e| format!("cert DER: {e}"))?;

    Ok(cert_der)
}

/// Create an intermediate (org) CA certificate signed by the root CA.
pub fn create_org_ca(
    root_private_key_der: &[u8],
    org_public_key_der: &[u8],
    org_name: &str,
    serial: u64,
) -> Result<Vec<u8>, String> {
    let root_private: RsaPrivateKey =
        rsa::pkcs8::DecodePrivateKey::from_pkcs8_der(root_private_key_der)
            .map_err(|e| format!("decode root priv: {e}"))?;

    let spki = SubjectPublicKeyInfoOwned::try_from(org_public_key_der)
        .map_err(|e| format!("SPKI: {e}"))?;

    let serial_bytes = serial.to_be_bytes();
    let sn = SerialNumber::new(&serial_bytes).map_err(|e| format!("serial: {e}"))?;
    let subject = Name::from_str(&format!("CN={org_name} CA"))
        .map_err(|e| format!("name: {e}"))?;
    let validity = Validity::from_now(core::time::Duration::from_secs(5 * 365 * 86400))
        .map_err(|e| format!("validity: {e}"))?;

    let signer: SigningKey<Sha256> = SigningKey::new(root_private);

    let builder = CertificateBuilder::new(
        Profile::SubCA {
            issuer: Name::from_str("CN=EnvSync Root CA")
                .map_err(|e| format!("issuer name: {e}"))?,
            path_len_constraint: Some(0),
        },
        sn,
        validity,
        subject,
        spki,
        &signer,
    )
    .map_err(|e| format!("builder: {e}"))?;

    let cert = builder.build().map_err(|e| format!("build cert: {e}"))?;
    cert.to_der().map_err(|e| format!("cert DER: {e}"))
}
