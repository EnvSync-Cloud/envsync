/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrgKmsCredentialResponse } from './OrgKmsCredentialResponse';
export type OrgKmsConfigResponse = {
    org_id: string;
    source: OrgKmsConfigResponse.source;
    status: OrgKmsConfigResponse.status;
    key_ref: string | null;
    region: string | null;
    credential_secret_id: string | null;
    kek_version: number;
    last_verified_at: string | null;
    last_error: string | null;
    implicit: boolean;
    credentials?: Array<OrgKmsCredentialResponse>;
};
export namespace OrgKmsConfigResponse {
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

