/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type LicenseState = {
    status: LicenseState.status;
    lease_expires_at?: string | null;
    last_verified_at?: string | null;
    last_error_code?: string | null;
    last_error_message?: string | null;
    validation_mode?: LicenseState.validation_mode;
    certificate_serial_hex?: string | null;
    certificate_fingerprint_sha256?: string | null;
    certificate_subject?: string | null;
    certificate_issuer?: string | null;
    certificate_expires_at?: string | null;
    root_ca_fingerprint_sha256?: string | null;
    validated_at?: string | null;
};
export namespace LicenseState {
    export enum status {
        UNKNOWN = 'unknown',
        ACTIVE = 'active',
        INACTIVE = 'inactive',
        EXPIRED = 'expired',
        ERROR = 'error',
        LOCKED = 'locked',
    }
    export enum validation_mode {
        NONE = 'none',
        LEASE = 'lease',
        CERTIFICATE = 'certificate',
    }
}

