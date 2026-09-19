-- Allow workload/service leaves alongside member certificates.
BEGIN;

ALTER TABLE certificates DROP CONSTRAINT IF EXISTS certificates_cert_type_check;
ALTER TABLE certificates
    ADD CONSTRAINT certificates_cert_type_check
    CHECK (cert_type = ANY (ARRAY['root_ca'::text, 'org_intermediate_ca'::text, 'member'::text, 'leaf'::text]));

COMMIT;
