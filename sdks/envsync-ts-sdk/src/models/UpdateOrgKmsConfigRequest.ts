/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateOrgKmsConfigRequest = {
    source: UpdateOrgKmsConfigRequest.source;
    key_ref?: string | null;
    region?: string | null;
    credential_secret_id?: string | null;
};
export namespace UpdateOrgKmsConfigRequest {
    export enum source {
        MANAGED = 'managed',
        AWS_KMS = 'aws-kms',
        GCP_KMS = 'gcp-kms',
        AZURE_KV = 'azure-kv',
    }
}

