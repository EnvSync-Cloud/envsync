/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SystemStatusState = {
    edition: SystemStatusState.edition;
    deployment_mode?: SystemStatusState.deployment_mode;
    single_org_mode: boolean;
    max_orgs?: number | null;
    public_signup_enabled?: boolean;
    can_create_organization?: boolean;
    management_enabled: boolean;
    observability_enabled: boolean;
    management_web_enabled: boolean;
    landing_enabled: boolean;
    first_bootstrap_completed_at?: string | null;
    org_count: number;
};
export namespace SystemStatusState {
    export enum edition {
        OSS = 'oss',
        ENTERPRISE = 'enterprise',
    }
    export enum deployment_mode {
        HOSTED = 'hosted',
        SELFHOSTED = 'selfhosted',
    }
}

