BEGIN;

ALTER TABLE certificates ADD COLUMN IF NOT EXISTS env_id text;

DROP INDEX IF EXISTS idx_certificates_active_org_ca;

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_active_org_ca
    ON certificates (org_id)
    WHERE cert_type = 'org_intermediate_ca' AND status = 'active' AND env_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_active_env_ca
    ON certificates (org_id, env_id)
    WHERE cert_type = 'org_intermediate_ca' AND status = 'active' AND env_id IS NOT NULL;

COMMIT;
