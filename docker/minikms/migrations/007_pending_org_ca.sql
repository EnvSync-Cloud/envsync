BEGIN;

ALTER TABLE certificates DROP CONSTRAINT IF EXISTS certificates_status_check;
ALTER TABLE certificates
    ADD CONSTRAINT certificates_status_check
    CHECK (status = ANY (ARRAY['active'::text, 'revoked'::text, 'expired'::text, 'pending'::text]));

COMMIT;
