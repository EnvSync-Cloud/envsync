/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type PutOrgFeatureGrantRequest = {
    plan?: PutOrgFeatureGrantRequest.plan;
    features?: Array<string>;
    overlay_features?: Array<string>;
    source?: PutOrgFeatureGrantRequest.source;
    updated_by?: string;
};
export namespace PutOrgFeatureGrantRequest {
    export enum plan {
        DEVELOPER = 'developer',
        PLUS = 'plus',
        ENTERPRISE = 'enterprise',
    }
    export enum source {
        BILLING = 'billing',
        SUPPORT = 'support',
        SEED = 'seed',
    }
}

