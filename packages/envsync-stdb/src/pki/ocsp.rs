/// OCSP status checking — checks if a certificate is revoked.

/// OCSP response status codes.
pub const OCSP_GOOD: u32 = 0;
pub const OCSP_REVOKED: u32 = 1;
pub const OCSP_UNKNOWN: u32 = 2;

/// Check OCSP status by looking up the serial in the CRL entries table.
/// Returns (status_code, revoked_at_timestamp_or_empty).
pub fn check_status(
    serial_hex: &str,
    revoked_entries: &[(String, u64)], // (serial_hex, revoked_at_micros)
) -> (u32, String) {
    for (s, ts) in revoked_entries {
        if s == serial_hex {
            return (OCSP_REVOKED, ts.to_string());
        }
    }
    (OCSP_GOOD, String::new())
}
