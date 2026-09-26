/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AcceptUserInviteResponse = {
    message: string;
    generated_certificate_bundle: {
        root_ca_pem: string;
        member_cert_pem: string;
        member_key_pem: string;
        member_certificate_id: string;
        member_serial_hex: string;
        is_system_generated: boolean;
    } | null;
};

