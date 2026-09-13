/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type OrgKmsVerifyResponse = {
    ok: boolean;
    source: OrgKmsVerifyResponse.source;
    status: OrgKmsVerifyResponse.status;
    last_verified_at: string;
};
export namespace OrgKmsVerifyResponse {
    export enum source {
        MANAGED = 'managed',
        AWS_KMS = 'aws-kms',
        GCP_KMS = 'gcp-kms',
        AZURE_KV = 'azure-kv',
    }
    export enum status {
        ACTIVE = 'active',
        PENDING = 'pending',
        ROTATING = 'rotating',
        UNAVAILABLE = 'unavailable',
        DISABLED = 'disabled',
    }
}

