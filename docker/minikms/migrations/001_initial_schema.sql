-- miniKMS initial schema
-- Phase 2: All miniKMS database tables

BEGIN;

-- Key versions: stores encrypted DEKs with encryption count tracking
CREATE TABLE IF NOT EXISTS key_versions (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    app_id TEXT NOT NULL,
    key_type TEXT NOT NULL DEFAULT 'app_dek',
    version INTEGER NOT NULL,
    encrypted_key BYTEA NOT NULL,
    encryption_count BIGINT NOT NULL DEFAULT 0,
    max_encryptions BIGINT NOT NULL DEFAULT 1073741824, -- 2^30
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rotate_pending', 'retired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_key_versions_org_app ON key_versions(org_id, app_id);
CREATE INDEX idx_key_versions_status ON key_versions(status);
CREATE UNIQUE INDEX idx_key_versions_active ON key_versions(org_id, app_id) WHERE status = 'active';

-- Token registry: stores ONLY jti + hash, never the full JWT (Issues #5, #12)
CREATE TABLE IF NOT EXISTS token_registry (
    jti TEXT PRIMARY KEY,
    subject_hash TEXT NOT NULL,
    jwt_hash TEXT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_token_registry_expires ON token_registry(expires_at);
CREATE INDEX idx_token_registry_subject ON token_registry(subject_hash);

-- Certificates: 3-level PKI hierarchy (Issue #3)
-- cert_type: root_ca, org_intermediate_ca, member (renamed from sub_ca)
CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    serial_number TEXT NOT NULL UNIQUE,
    cert_type TEXT NOT NULL CHECK (cert_type IN ('root_ca', 'org_intermediate_ca', 'member')),
    org_id TEXT,
    subject_cn TEXT NOT NULL,
    cert_pem TEXT NOT NULL,
    encrypted_private_key BYTEA,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_certificates_org ON certificates(org_id);
CREATE INDEX idx_certificates_type ON certificates(cert_type);
CREATE INDEX idx_certificates_status ON certificates(status);

-- CRL entries: supports both full and delta CRLs (Issue #9)
CREATE TABLE IF NOT EXISTS crl_entries (
    id TEXT PRIMARY KEY,
    cert_serial TEXT NOT NULL REFERENCES certificates(serial_number),
    issuer_serial TEXT NOT NULL,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason INTEGER NOT NULL DEFAULT 0,
    crl_number BIGINT NOT NULL,
    is_delta BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crl_entries_issuer ON crl_entries(issuer_serial);
CREATE INDEX idx_crl_entries_cert ON crl_entries(cert_serial);

-- KMS audit log: hash-chained entries (Issue #11)
-- entry_hash = SHA256(previous_hash || timestamp || action || actor_id || details)
-- Genesis entry uses 64 zero chars as previous_hash
CREATE TABLE IF NOT EXISTS kms_audit_log (
    id TEXT PRIMARY KEY,
    previous_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    action TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    details TEXT,
    request_jwt_hash TEXT -- SHA-256 of JWT used for this request (Issue #12)
);

CREATE INDEX idx_kms_audit_log_org ON kms_audit_log(org_id);
CREATE INDEX idx_kms_audit_log_timestamp ON kms_audit_log(timestamp DESC);
CREATE INDEX idx_kms_audit_log_action ON kms_audit_log(action);

-- Key escrow shares: Shamir Secret Sharing for disaster recovery (Issue #7)
CREATE TABLE IF NOT EXISTS key_escrow_shares (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    share_index INTEGER NOT NULL,
    total_shares INTEGER NOT NULL,
    threshold INTEGER NOT NULL,
    encrypted_share BYTEA NOT NULL,
    custodian_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_key_escrow_shares_org ON key_escrow_shares(org_id);
CREATE UNIQUE INDEX idx_key_escrow_shares_org_index ON key_escrow_shares(org_id, share_index);

COMMIT;
