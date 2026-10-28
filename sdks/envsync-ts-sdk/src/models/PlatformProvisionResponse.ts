/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type PlatformProvisionResponse = {
    org_id: string;
    org_name: string;
    org_slug: string;
    user_id: string;
    auth_service_id: string | null;
    plan: PlatformProvisionResponse.plan;
    overlay_features: Array<string>;
    mode: PlatformProvisionResponse.mode;
};
export namespace PlatformProvisionResponse {
    export enum plan {
        DEVELOPER = 'developer',
        PLUS = 'plus',
        ENTERPRISE = 'enterprise',
    }
    export enum mode {
        EXISTING_IDENTITY = 'existing_identity',
        FRESH_TENANT = 'fresh_tenant',
    }
}

