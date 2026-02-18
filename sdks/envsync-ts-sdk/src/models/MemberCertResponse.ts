/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type MemberCertResponse = {
    id: string;
    org_id: string;
    serial_hex: string;
    cert_type: string;
    subject_cn: string;
    subject_email: string | null;
    status: string;
    metadata?: Record<string, string> | null;
    cert_pem: string;
    key_pem: string;
    created_at: string;
};

