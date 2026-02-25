use der::Encode;
use rsa::pkcs1v15::SigningKey;
use rsa::RsaPrivateKey;
use sha2::Sha256;
use x509_cert::builder::{Builder, CertificateBuilder, Profile};
use x509_cert::name::Name;
use x509_cert::serial_number::SerialNumber;
use x509_cert::spki::SubjectPublicKeyInfoOwned;
use x509_cert::time::Validity;

use core::str::FromStr;

/// Issue a member (leaf) certificate signed by the org CA.
pub fn issue_member_cert(
    org_ca_private_key_der: &[u8],
    member_public_key_der: &[u8],
    member_email: &str,
    org_name: &str,
    serial: u64,
) -> Result<Vec<u8>, String> {
    let ca_private: RsaPrivateKey =
        rsa::pkcs8::DecodePrivateKey::from_pkcs8_der(org_ca_private_key_der)
            .map_err(|e| format!("decode CA priv: {e}"))?;

    let spki = SubjectPublicKeyInfoOwned::try_from(member_public_key_der)
        .map_err(|e| format!("SPKI: {e}"))?;

    let serial_bytes = serial.to_be_bytes();
    let sn = SerialNumber::new(&serial_bytes).map_err(|e| format!("serial: {e}"))?;
    let subject = Name::from_str(&format!("CN={member_email}"))
        .map_err(|e| format!("name: {e}"))?;
    let validity = Validity::from_now(core::time::Duration::from_secs(365 * 86400))
        .map_err(|e| format!("validity: {e}"))?;

    let signer: SigningKey<Sha256> = SigningKey::new(ca_private);

    let builder = CertificateBuilder::new(
        Profile::Leaf {
            issuer: Name::from_str(&format!("CN={org_name} CA"))
                .map_err(|e| format!("issuer name: {e}"))?,
            enable_key_agreement: false,
            enable_key_encipherment: true,
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
