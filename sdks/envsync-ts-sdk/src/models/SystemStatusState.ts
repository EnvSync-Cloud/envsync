/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SystemStatusState = {
    edition: SystemStatusState.edition;
    single_org_mode: boolean;
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
}

