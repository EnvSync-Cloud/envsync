/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type PlatformProvisionRequest = {
    mode: PlatformProvisionRequest.mode;
    organization_name: string;
    slug?: string;
    plan?: PlatformProvisionRequest.plan;
    overlay_features?: Array<string>;
    membership_user_id?: string;
    admin_email?: string;
    admin_full_name?: string;
    actor_email?: string;
};
export namespace PlatformProvisionRequest {
    export enum mode {
        EXISTING_IDENTITY = 'existing_identity',
        FRESH_TENANT = 'fresh_tenant',
    }
    export enum plan {
        DEVELOPER = 'developer',
        PLUS = 'plus',
        ENTERPRISE = 'enterprise',
    }
}

