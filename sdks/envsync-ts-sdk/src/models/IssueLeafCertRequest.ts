/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type IssueLeafCertRequest = {
    app_id: string;
    env_type_id?: string;
    common_name: string;
    sans?: Array<string>;
    ttl_days?: number;
    key_algorithm?: IssueLeafCertRequest.key_algorithm;
    description?: string;
};
export namespace IssueLeafCertRequest {
    export enum key_algorithm {
        ECDSA_P256 = 'ECDSA_P256',
        RSA_2048 = 'RSA_2048',
    }
}

