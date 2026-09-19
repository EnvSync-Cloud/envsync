-- Enforce one active organization CA so bootstrap remains idempotent when
-- requests are handled concurrently by multiple miniKMS replicas.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_active_org_ca
    ON certificates (org_id)
    WHERE cert_type = 'org_intermediate_ca' AND status = 'active';

COMMIT;
