-- Complete Shamir escrow generations, integrity metadata, and export tracking.
-- Existing rows predate verifiable recovery sets and are intentionally left
-- unattached; operators must generate and distribute a new escrow generation.
--
-- Synced from EnvSync-Cloud/minikms@sha-9ffbf53.

BEGIN;

CREATE TABLE IF NOT EXISTS key_escrow_sets (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    key_type TEXT NOT NULL CHECK (key_type IN ('root', 'org_ca')),
    total_shares INTEGER NOT NULL CHECK (total_shares BETWEEN 2 AND 255),
    threshold INTEGER NOT NULL CHECK (threshold BETWEEN 2 AND total_shares),
    secret_hash BYTEA NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recovered_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_key_escrow_sets_active
    ON key_escrow_sets(org_id, key_type)
    WHERE status = 'active';

ALTER TABLE key_escrow_shares
    ADD COLUMN IF NOT EXISTS set_id TEXT REFERENCES key_escrow_sets(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS share_hash BYTEA,
    ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ;

DROP INDEX IF EXISTS idx_key_escrow_shares_org_index;

CREATE UNIQUE INDEX IF NOT EXISTS idx_key_escrow_shares_set_index
    ON key_escrow_shares(set_id, share_index)
    WHERE set_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_key_escrow_shares_set
    ON key_escrow_shares(set_id)
    WHERE set_id IS NOT NULL;

COMMIT;
