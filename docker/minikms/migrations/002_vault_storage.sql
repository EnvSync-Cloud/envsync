-- miniKMS vault storage schema
-- Zero-trust vault: vault_entries, org_ca_wraps, org_security_policy

BEGIN;

-- Vault entries: replaces HashiCorp Vault KV v2 storage
-- Stores 3-layer encrypted blobs (RSA/Hybrid + ECIES + KMS envelope)
CREATE TABLE IF NOT EXISTS vault_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          TEXT NOT NULL,
    scope_id        TEXT NOT NULL,          -- app_id
    entry_type      TEXT NOT NULL CHECK (entry_type IN ('env', 'secret', 'gpg')),
    key             TEXT NOT NULL,
    env_type_id     TEXT,                   -- for env/secret scoping
    encrypted_value BYTEA NOT NULL,         -- full 3-layer encrypted blob
    key_version_id  TEXT NOT NULL,          -- KMS DEK version used
    version         INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,            -- soft delete
    destroyed       BOOLEAN NOT NULL DEFAULT FALSE,  -- permanent delete
    created_by      TEXT,                   -- member_id who created this version

    CONSTRAINT unique_active_version
      UNIQUE (org_id, scope_id, entry_type, key, env_type_id, version)
);

CREATE INDEX idx_vault_entries_scope
  ON vault_entries (org_id, scope_id, entry_type, env_type_id)
  WHERE destroyed = FALSE AND deleted_at IS NULL;

CREATE INDEX idx_vault_entries_key
  ON vault_entries (org_id, scope_id, key)
  WHERE destroyed = FALSE AND deleted_at IS NULL;

-- Org CA wraps: per-member ECDH wrapping of Org CA private key
-- Each member gets their own wrapped copy, enabling zero-trust key recovery
CREATE TABLE IF NOT EXISTS org_ca_wraps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          TEXT NOT NULL,
    member_id       TEXT NOT NULL,
    cert_serial     TEXT NOT NULL,
    ephemeral_pub   BYTEA NOT NULL,        -- ECDH ephemeral public key (P-384 uncompressed)
    wrapped_key     BYTEA NOT NULL,        -- AES-256-GCM encrypted Org CA private key
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

-- Only one active wrap per member per org
CREATE UNIQUE INDEX idx_org_ca_wraps_active
  ON org_ca_wraps (org_id, member_id)
  WHERE revoked_at IS NULL;

CREATE INDEX idx_org_ca_wraps_org
  ON org_ca_wraps (org_id)
  WHERE revoked_at IS NULL;

-- Per-org security policy
CREATE TABLE IF NOT EXISTS org_security_policy (
    org_id                TEXT PRIMARY KEY,
    require_byok          BOOLEAN DEFAULT FALSE,    -- disallow managed member keys
    session_duration_sec  INTEGER DEFAULT 28800,     -- 8 hours
    max_session_tokens    INTEGER DEFAULT 10,        -- per member
    require_mfa_for_admin BOOLEAN DEFAULT TRUE,
    shamir_threshold      INTEGER DEFAULT 3,
    shamir_total_shares   INTEGER DEFAULT 5,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Session tokens: extends token_registry with cert binding
-- Add cert_serial and scopes columns to token_registry
ALTER TABLE token_registry
  ADD COLUMN IF NOT EXISTS cert_serial TEXT,
  ADD COLUMN IF NOT EXISTS scopes TEXT[];

COMMIT;
