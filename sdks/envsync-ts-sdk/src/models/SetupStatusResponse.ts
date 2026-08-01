/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SetupStatusResponse = {
    deployment_mode: SetupStatusResponse.deployment_mode;
    edition: SetupStatusResponse.edition;
    org_count: number;
    max_orgs: number | null;
    can_create_organization: boolean;
    first_org_ready: boolean;
    channel: string;
};
export namespace SetupStatusResponse {
    export enum deployment_mode {
        HOSTED = 'hosted',
        SELFHOSTED = 'selfhosted',
    }
    export enum edition {
        OSS = 'oss',
        ENTERPRISE = 'enterprise',
    }
}

